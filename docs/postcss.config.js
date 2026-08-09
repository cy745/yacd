// docs 独立构建时用空 postcss 配置,避免向上继承根目录配置
// (根 postcss.config.js 引用 @tailwindcss/postcss,docs 是独立 npm 包不装它)
export default {
  plugins: {},
};
