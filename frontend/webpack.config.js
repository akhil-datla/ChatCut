const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/index.jsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  devtool: "cheap-eval-source-map", // won't work on XD due to lack of eval
  externals: {
    uxp: "commonjs2 uxp",
    premierepro: "commonjs2 premierepro",
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: "babel-loader",
        options: {
          plugins: [
            "@babel/transform-react-jsx",
            "@babel/proposal-object-rest-spread",
            "@babel/plugin-syntax-class-properties",
          ],
        },
      },
      {
        test: /\.png$/,
        exclude: /node_modules/,
        loader: "file-loader",
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    //new CleanWebpackPlugin(),
    new CopyPlugin([
      {
        from: "plugin",
        to: ".",
        ignore: ["index.html", "manifest.json"], // These will be copied from dist
      },
    ], {
      copyUnmodified: true,
    }),
    // Copy built files back to plugin folder for development
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap("CopyToPlugin", (compilation) => {
          const fs = require("fs");
          const path = require("path");
          const distPath = path.resolve(__dirname, "dist");
          const pluginPath = path.resolve(__dirname, "plugin");
          
          // Copy index.js
          const indexJs = path.join(distPath, "index.js");
          const pluginIndexJs = path.join(pluginPath, "index.js");
          if (fs.existsSync(indexJs)) {
            fs.copyFileSync(indexJs, pluginIndexJs);
            console.log("Copied index.js to plugin folder");
          }
          
          // Copy index.html
          const indexHtml = path.join(distPath, "index.html");
          const pluginIndexHtml = path.join(pluginPath, "index.html");
          if (fs.existsSync(indexHtml)) {
            fs.copyFileSync(indexHtml, pluginIndexHtml);
            console.log("Copied index.html to plugin folder");
          }
          
          // Copy manifest.json
          const manifest = path.join(distPath, "manifest.json");
          const pluginManifest = path.join(pluginPath, "manifest.json");
          if (fs.existsSync(manifest)) {
            fs.copyFileSync(manifest, pluginManifest);
            console.log("Copied manifest.json to plugin folder");
          }
        });
      },
    },
  ],
};
