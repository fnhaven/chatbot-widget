const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');
const cssPath = path.join(srcDir, 'styles.css');
const jsPath = path.join(srcDir, 'widget.js');
const outPath = path.join(distDir, 'widget.min.js');

const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const escapedCSS = css.replace(/`/g, '\\`').replace(/\$/g, '\\$');
const bundled = js.replace('__CSS_PLACEHOLDER__', escapedCSS);

async function build() {
  let minified = bundled;
  try {
    const { minify } = require('terser');
    const result = await minify(bundled, {
      compress: {
        drop_console: false,
      },
      mangle: true,
      format: {
        comments: false,
      },
    });
    if (result.code) {
      minified = result.code;
    }
  } catch (e) {
    console.warn('Terser minify failed:', e.message);
  }

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  fs.writeFileSync(outPath, minified, 'utf8');
  console.log('Built:', outPath, `(${Math.round(minified.length / 1024)}KB)`);
}

build();
