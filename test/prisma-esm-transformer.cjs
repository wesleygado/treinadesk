// Transformer do Jest: ts-jest + um ajuste no client gerado do Prisma.
//
// O pacote é ESM, então `prisma generate` emite em src/generated um client com
// `import.meta.url`. Os testes rodam em CommonJS (ts-jest com module commonjs),
// onde import.meta não existe e o arquivo falha com "exports is not defined".
// Só nos arquivos de src/generated, troca import.meta.url pelo equivalente
// CommonJS. O código de produção (nest build) não passa por aqui.
const tsJest = require('ts-jest').default;

// Separador / ou \ (Windows).
const GENERATED = /[/\\]src[/\\]generated[/\\]/;
const CJS_URL = "require('node:url').pathToFileURL(__filename).href";

const patch = (source, path) =>
  GENERATED.test(path) ? source.replaceAll('import.meta.url', CJS_URL) : source;

module.exports = {
  createTransformer(config) {
    const inner = tsJest.createTransformer(config);
    return {
      canInstrument: inner.canInstrument,
      process: (source, path, options) =>
        inner.process(patch(source, path), path, options),
      processAsync: (source, path, options) =>
        inner.processAsync(patch(source, path), path, options),
      getCacheKey: (source, path, options) =>
        inner.getCacheKey(patch(source, path), path, options),
      getCacheKeyAsync: (source, path, options) =>
        inner.getCacheKeyAsync(patch(source, path), path, options),
    };
  },
};
