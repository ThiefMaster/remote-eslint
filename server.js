const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const morgan = require('morgan');
const CliEngine = require('eslint/lib/cli-engine');
const config = require('./config');


function mapPath(path) {
    for (const [remote, local] of Object.entries(config.pathMap)) {
        if (path.toLowerCase().startsWith(remote.toLowerCase())) {
            return path.replace(new RegExp(`^${remote}`, 'i'), local).replace(/\\/g, '/');
        }
    }
}

function mapPathReverse(path) {
    for (const [remote, local] of Object.entries(config.pathMap)) {
        if (path.startsWith(local)) {
            return path.replace(new RegExp(`^${local}`), remote).replace(/\//g, '\\');
        }
    }
}

function mapOptions(options) {
    ['ignorePath', 'configFile'].forEach((prop) => {
        if (options[prop]) {
            options[prop] = mapPath(options[prop]);
        }
    });

}

function makeEngine(options, cwd) {
    const engine = new CliEngine(options);
    engine.options.cwd = mapPath(cwd);
    return engine;
}

function executeOnText(options, cwd, text, filename, warnIgnored) {
    filename = mapPath(filename);
    const engine = makeEngine(options, cwd);
    const rv = engine.executeOnText(text, filename, warnIgnored);
    rv.results.forEach((entry) => {
        entry.filePath = mapPathReverse(entry.filePath);
    });
    return rv;
}

function executeOnFiles(options, cwd, patterns) {
    patterns = patterns.map(mapPath);
    const engine = makeEngine(options, cwd);
    const rv = engine.executeOnFiles(patterns);
    rv.results.forEach((entry) => {
        entry.filePath = mapPathReverse(entry.filePath);
    });
    return rv;
}

function isPathIgnored(options, cwd, filePath) {
    filePath = mapPath(filePath);
    const engine = makeEngine(options, cwd);
    return engine.isPathIgnored(filePath);
}

function createServer(app) {
    if (!config.server.ssl) {
        return http.createServer(app);
    }
    const opts = {
        key: fs.readFileSync(config.server.ssl.key),
        cert: fs.readFileSync(config.server.ssl.cert),
    };
    return https.createServer(opts, app);
}


const app = express();
app.use(morgan(':remote-addr [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms'));
app.use(express.json());

app.use((req, res, next) => {
    const token = req.headers['x-token'];
    if (token !== config.secret || !config.secret) {
        return res.status(401).send({error: 'Unauthorized'});
    }
    next();
});

app.post('/text', (req, res) => {
    const {cwd, options, text, filename, warnIgnored} = req.body;
    mapOptions(options);
    const rv = executeOnText(options, cwd, text, filename, warnIgnored);
    res.send(rv);
});

app.post('/files', (req, res) => {
    const {cwd, options, patterns} = req.body;
    mapOptions(options);
    const rv = executeOnFiles(options, cwd, patterns);
    res.send(rv);
});

app.post('/ignored', (req, res) => {
    const {cwd, options, filePath} = req.body;
    mapOptions(options);
    const rv = isPathIgnored(options, cwd, filePath);
    res.send(rv);
});


app.use(function(req, res) {
    res.status(404).send({error: 'Not Found'});
});

// eslint-disable-next-line no-unused-vars
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.send({error: err.message});
});

createServer(app).listen(config.server.bindPort, config.server.bindHost);
