import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const rtlReq = createRequire(req.resolve('@testing-library/react'));
const sharedReactPath = rtlReq.resolve('react');
const sharedReactDomPath = rtlReq.resolve('react-dom');
const sharedJsxRuntimePath = rtlReq.resolve('react/jsx-runtime');
const sharedJsxDevRuntimePath = rtlReq.resolve('react/jsx-dev-runtime');

const webSrcDir = path.resolve(fileURLToPath(import.meta.url), '../../../src');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react') {
    return { url: pathToFileURL(sharedReactPath).href, shortCircuit: true };
  }
  if (specifier === 'react-dom') {
    return { url: pathToFileURL(sharedReactDomPath).href, shortCircuit: true };
  }
  if (specifier === 'react/jsx-runtime') {
    return { url: pathToFileURL(sharedJsxRuntimePath).href, shortCircuit: true };
  }
  if (specifier === 'react/jsx-dev-runtime') {
    return { url: pathToFileURL(sharedJsxDevRuntimePath).href, shortCircuit: true };
  }
  if (specifier === 'socket.io-client') {
    const mockSocketPath = path.resolve(fileURLToPath(import.meta.url), '../mock-socket-client.mjs');
    return { url: pathToFileURL(mockSocketPath).href, shortCircuit: true };
  }
  if (specifier === 'next/link') {
    return nextResolve('next/link.js', context);
  }
  if (specifier.startsWith('@/')) {
    const relPath = specifier.slice(2);
    const candidateBase = path.join(webSrcDir, relPath);
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
      const candidate = candidateBase + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }

  if (specifier.startsWith('.') && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const candidateBase = path.resolve(path.dirname(parentPath), specifier);
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const candidate = candidateBase + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx') || url.endsWith('.ts')) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: filePath,
    });
    return {
      format: 'module',
      shortCircuit: true,
      source: result.outputText,
    };
  }
  return nextLoad(url, context);
}
