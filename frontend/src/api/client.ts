import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: (() => void)[] = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // 只有"带着 accessToken 发出的请求"收到 401 才代表登录态过期，需要尝试刷新/跳登录页；
    // 像登录接口本身返回的 401（用户名或密码错误）没有带 token，属于正常的业务错误，
    // 应该原样 reject 让调用方（比如 Login.tsx 的 catch）弹出错误提示，而不是被这里当成
    // "登录过期"清空 localStorage 并强制跳转，把错误提示直接冲掉。
    const hadAuthHeader = Boolean(original?.headers?.Authorization);
    if (hadAuthHeader && error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          pendingQueue.forEach((cb) => cb());
          pendingQueue = [];
        } catch (e) {
          localStorage.clear();
          window.location.href = "/login";
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      }
      return new Promise((resolve) => {
        pendingQueue.push(() => resolve(api(original)));
      });
    }
    return Promise.reject(error);
  }
);
