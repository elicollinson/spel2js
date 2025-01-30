import path from 'path';
import nodeExternals from 'webpack-node-externals';

export default {
    entry: './src/main.js',
    output: {
        path: path.resolve('./dist'),
        filename: 'spel2js.js',
        library: 'spel2js',
        libraryTarget: 'umd'
    },
    externals: [nodeExternals()],
    resolve: {
        extensions: ['.js']
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: 'babel-loader'
            }
        ]
    },
    plugins: []
};