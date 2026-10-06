import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["error", { allow: ["warn"] }],
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"] },
];

export default config;
