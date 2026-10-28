const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const API_URL = rawUrl.replace(/\/+$/, "");

export const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];
