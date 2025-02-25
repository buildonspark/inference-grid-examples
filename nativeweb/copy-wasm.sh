#!/bin/bash
mkdir -p public/node_modules/.vite/deps
cp node_modules/@buildonspark/spark-sdk/dist/wasm/spark_bindings_bg.wasm public/node_modules/.vite/deps/spark_bindings_bg.wasm