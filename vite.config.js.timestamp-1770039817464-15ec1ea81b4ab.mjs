// vite.config.js
import { sveltekit } from "file:///C:/Users/Jose/Downloads/wvm-main%20(1)/wvm-main/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import { defineConfig } from "file:///C:/Users/Jose/Downloads/wvm-main%20(1)/wvm-main/node_modules/vite/dist/node/index.js";
import { viteStaticCopy } from "file:///C:/Users/Jose/Downloads/wvm-main%20(1)/wvm-main/node_modules/vite-plugin-static-copy/dist/index.js";
import path from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/Jose/Downloads/wvm-main%20(1)/wvm-main/vite.config.js";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var vite_config_default = defineConfig({
  resolve: {
    alias: {
      "/config_terminal": path.resolve(__dirname, process.env.WEBVM_MODE == "github" ? "config_github_terminal.js" : "config_public_terminal.js"),
      "@leaningtech/cheerpx": process.env.CX_URL ? process.env.CX_URL : "@leaningtech/cheerpx"
    }
  },
  ssr: {
    noExternal: [/config_.*\.js$/]
  },
  build: {
    target: "es2022"
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022"
    }
  },
  server: {
    fs: {
      allow: ["."]
    }
  },
  plugins: [
    sveltekit(),
    viteStaticCopy({
      targets: [
        { src: "tower.ico", dest: "" },
        { src: "scrollbar.css", dest: "" },
        { src: "serviceWorker.js", dest: "" },
        { src: "login.html", dest: "" },
        { src: "assets/", dest: "" },
        { src: "documents/", dest: "" },
        { src: "disk-images/", dest: "" }
      ]
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxKb3NlXFxcXERvd25sb2Fkc1xcXFx3dm0tbWFpbiAoMSlcXFxcd3ZtLW1haW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEpvc2VcXFxcRG93bmxvYWRzXFxcXHd2bS1tYWluICgxKVxcXFx3dm0tbWFpblxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvSm9zZS9Eb3dubG9hZHMvd3ZtLW1haW4lMjAoMSkvd3ZtLW1haW4vdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBzdmVsdGVraXQgfSBmcm9tICdAc3ZlbHRlanMva2l0L3ZpdGUnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyB2aXRlU3RhdGljQ29weSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5JztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5cbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuXHRyZXNvbHZlOiB7XG5cdFx0YWxpYXM6IHtcblx0XHRcdCcvY29uZmlnX3Rlcm1pbmFsJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgcHJvY2Vzcy5lbnYuV0VCVk1fTU9ERSA9PSBcImdpdGh1YlwiID8gJ2NvbmZpZ19naXRodWJfdGVybWluYWwuanMnIDogJ2NvbmZpZ19wdWJsaWNfdGVybWluYWwuanMnKSxcblx0XHRcdFwiQGxlYW5pbmd0ZWNoL2NoZWVycHhcIjogcHJvY2Vzcy5lbnYuQ1hfVVJMID8gcHJvY2Vzcy5lbnYuQ1hfVVJMIDogXCJAbGVhbmluZ3RlY2gvY2hlZXJweFwiXG5cdFx0fVxuXHR9LFxuXHRzc3I6IHtcblx0XHRub0V4dGVybmFsOiBbL2NvbmZpZ18uKlxcLmpzJC9dXG5cdH0sXG5cdGJ1aWxkOiB7XG5cdFx0dGFyZ2V0OiBcImVzMjAyMlwiXG5cdH0sXG5cdG9wdGltaXplRGVwczoge1xuXHRcdGVzYnVpbGRPcHRpb25zOiB7XG5cdFx0XHR0YXJnZXQ6IFwiZXMyMDIyXCJcblx0XHR9XG5cdH0sXG5cdHNlcnZlcjoge1xuXHRcdGZzOiB7XG5cdFx0XHRhbGxvdzogWycuJ11cblx0XHR9XG5cdH0sXG5cdHBsdWdpbnM6IFtcblx0XHRzdmVsdGVraXQoKSxcblx0XHR2aXRlU3RhdGljQ29weSh7XG5cdFx0XHR0YXJnZXRzOiBbXG5cdFx0XHRcdHsgc3JjOiAndG93ZXIuaWNvJywgZGVzdDogJycgfSxcblx0XHRcdFx0eyBzcmM6ICdzY3JvbGxiYXIuY3NzJywgZGVzdDogJycgfSxcblx0XHRcdFx0eyBzcmM6ICdzZXJ2aWNlV29ya2VyLmpzJywgZGVzdDogJycgfSxcblx0XHRcdFx0eyBzcmM6ICdsb2dpbi5odG1sJywgZGVzdDogJycgfSxcblx0XHRcdFx0eyBzcmM6ICdhc3NldHMvJywgZGVzdDogJycgfSxcblx0XHRcdFx0eyBzcmM6ICdkb2N1bWVudHMvJywgZGVzdDogJycgfSxcblx0XHRcdFx0eyBzcmM6ICdkaXNrLWltYWdlcy8nLCBkZXN0OiAnJyB9XG5cdFx0XHRdXG5cdFx0fSlcblx0XVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVVLFNBQVMsaUJBQWlCO0FBQ2pXLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sVUFBVTtBQUNqQixTQUFTLHFCQUFxQjtBQUorSyxJQUFNLDJDQUEyQztBQU05UCxJQUFNLFlBQVksS0FBSyxRQUFRLGNBQWMsd0NBQWUsQ0FBQztBQUU3RCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMzQixTQUFTO0FBQUEsSUFDUixPQUFPO0FBQUEsTUFDTixvQkFBb0IsS0FBSyxRQUFRLFdBQVcsUUFBUSxJQUFJLGNBQWMsV0FBVyw4QkFBOEIsMkJBQTJCO0FBQUEsTUFDMUksd0JBQXdCLFFBQVEsSUFBSSxTQUFTLFFBQVEsSUFBSSxTQUFTO0FBQUEsSUFDbkU7QUFBQSxFQUNEO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSixZQUFZLENBQUMsZ0JBQWdCO0FBQUEsRUFDOUI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNOLFFBQVE7QUFBQSxFQUNUO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDYixnQkFBZ0I7QUFBQSxNQUNmLFFBQVE7QUFBQSxJQUNUO0FBQUEsRUFDRDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ1AsSUFBSTtBQUFBLE1BQ0gsT0FBTyxDQUFDLEdBQUc7QUFBQSxJQUNaO0FBQUEsRUFDRDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1IsVUFBVTtBQUFBLElBQ1YsZUFBZTtBQUFBLE1BQ2QsU0FBUztBQUFBLFFBQ1IsRUFBRSxLQUFLLGFBQWEsTUFBTSxHQUFHO0FBQUEsUUFDN0IsRUFBRSxLQUFLLGlCQUFpQixNQUFNLEdBQUc7QUFBQSxRQUNqQyxFQUFFLEtBQUssb0JBQW9CLE1BQU0sR0FBRztBQUFBLFFBQ3BDLEVBQUUsS0FBSyxjQUFjLE1BQU0sR0FBRztBQUFBLFFBQzlCLEVBQUUsS0FBSyxXQUFXLE1BQU0sR0FBRztBQUFBLFFBQzNCLEVBQUUsS0FBSyxjQUFjLE1BQU0sR0FBRztBQUFBLFFBQzlCLEVBQUUsS0FBSyxnQkFBZ0IsTUFBTSxHQUFHO0FBQUEsTUFDakM7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
