const fs = require("fs-nextra");
const { sep, resolve, join } = require("path");
const Discord = require("discord.js");
const ParsedUsage = require("./parsedUsage");
const Stopwatch = new (require("../util/Stopwatch"))();

class Loader {

  constructor(client) {
    Object.defineProperty(this, "client", { value: client });
    const makeDirsObject = dir => ({
      functions: resolve(dir, "functions"),
      commands: resolve(dir, "commands"),
      inhibitors: resolve(dir, "inhibitors"),
      finalizers: resolve(dir, "finalizers"),
      events: resolve(dir, "events"),
      monitors: resolve(dir, "monitors"),
      providers: resolve(dir, "providers"),
      extendables: resolve(dir, "extendables"),
    });

    /**
     * An object containing string paths to piece folders for the core of Komada
     * @type {Object}
     */
    Object.defineProperty(this, "coreDirs", { value: makeDirsObject(this.client.coreBaseDir) });

    /**
     * An object containing string paths to piece folders for the user side of Komada
     * @type {Object}
     */
    Object.defineProperty(this, "clientDirs", { value: makeDirsObject(this.client.clientBaseDir) });
  }

  async loadAll() {
    await Promise.all([
      this._loadFunctions(),
      /** this.loadCommands(),
      this.loadInhibitors(),
      this.loadFinalizers(),
      this.loadEvents(),
      this.loadMonitors(),
      this.loadProviders(),
      this.loadExtendables(),* */
    ]).catch((error) => {
      console.error(error);
      process.exit();
    });
  }

  async _traverse(dir, fileArray = []) {
    try {
      const res = await fs.readdir(dir);
      const files = res.filter(thing => thing.endsWith(".js"));
      const dirs = res.filter(thing => !thing.includes("."));
      if (files) files.forEach(file => fileArray.push([dir, file]));
      if (dirs) await Promise.all(dirs.map(dir2 => this._traverse(resolve(dir, dir2), fileArray)));
      return fileArray;
    } catch (err) {
      await fs.ensureDir(dir).catch(console.error);
      return err; // satisfy consistent return
    }
  }

  async _loadFunctions() {
    Stopwatch.start();
    const [coreFiles, userFiles] = await Promise.all([
      this.traverse(this.coreDirs.functions),
      this.traverse(this.clientDirs.functions),
    ]);
    if (coreFiles) {
      coreFiles.forEach(this._loadFunction);
    }
    if (userFiles) {
      userFiles.forEach(this._loadFunction);
    }
    Stopwatch.stop();
    this.client.emit("log", `Loaded ${this.size} functions in ${Stopwatch.duration}`);
    Stopwatch.reset();
  }

  _loadFunction(dir, file) {
    this[file.split(".")[0]] = this._require(join(dir, file));
  }

  get size() {
    return Object.keys(this).length;
  }

  static _require(path) {
    try {
      const module = require(path); // eslint-disable-line
      return module;
    } catch (err) {
      console.error(err);
      return process.exit();
    } finally {
      delete require.cache[path];
    }
  }


}

module.exports = Loader;
