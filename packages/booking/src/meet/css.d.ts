// /meet's CSS modules: esbuild gives each class a name of its own (scripts/build.mjs).
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
