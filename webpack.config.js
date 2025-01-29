import path from 'path';
import nodeExternals from 'webpack-node-externals';

export default {
    entry: './src/main.ts',
    output: {
        path: path.resolve('./dist'),
        filename: 'spel2js.js',
        library: 'spel2js',
        libraryTarget: 'umd'
    },
    externals: [nodeExternals()],
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: 'ts-loader'
            }
        ]
    },
    plugins: []
};