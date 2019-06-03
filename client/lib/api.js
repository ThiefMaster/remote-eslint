const config = require('../../config');
// must be set before importing sync-request
process.env.NODE_TLS_REJECT_UNAUTHORIZED = config.client.ignoreInvalidCert ? '0' : '1';

const ESLintCliEngine = require('eslint/lib/cli-engine');
const request = require('sync-request');
const zlib = require('zlib');


function req(method, path, payload) {
    const opts = {
        json: payload,
        headers: {'x-token': config.secret}
    };
    path = path.replace(/\/+$/, '');
    return request(method, config.client.url + path, opts).getBody();
}

class CLIEngine {
    constructor(options) {
        this.options = options;
    }

    isPathIgnored(filePath) {
        const payload = {filePath, options: this.options, cwd: process.cwd()};
        const response = req('POST', '/ignored', payload);
        return JSON.parse(response);
    }

    executeOnText(text, filename, warnIgnored) {
        const payload = {
            filename,
            warnIgnored,
            options: this.options,
            cwd: process.cwd(),
            gzText: zlib.deflateSync(text).toString('base64'),
        };
        const response = req('POST', '/text', payload);
        return JSON.parse(response);
    }

    executeOnFiles(patterns) {
        const payload = {patterns, options: this.options, cwd: process.cwd()};
        const response = req('POST', '/files', payload);
        return JSON.parse(response);
    }

    getFormatter() {
        return JSON.stringify.bind(JSON);
    }

    getConfigForFile() {
        return {};
    }

    static outputFixes(report) {
        return ESLintCliEngine.outputFixes(report);
    }
};

module.exports = {CLIEngine: CLIEngine};
