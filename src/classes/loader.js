const fs = require("fs-nextra");
const { sep, resolve, join } = require("path");
const Discord = require("discord.js");
const ParsedUsage = require("./parsedUsage");
const { performance: { now } } = require("perf_hooks");

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
      this._loadEvents(),
      this._loadFunctions(),
      this._loadCommands(),
      /**    this.loadInhibitors(),
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
      return null;
    }
  }

  /** FUNCTIONS */

  async _loadFunctions() {
    const time = now();
    const [coreFiles, userFiles] = await Promise.all([
      this._traverse(this.coreDirs.functions),
      this._traverse(this.clientDirs.functions),
    ]);
    if (coreFiles) {
      coreFiles.forEach(this._loadFunction.bind(this));
    }
    if (userFiles) {
      userFiles.forEach(this._loadFunction.bind(this));
    }
    this.client.emit("log", `Loaded ${this.size} functions in ${this.constructor._friendlyDuration(now() - time)}`);
  }

  _loadFunction([dir, file]) {
    this[file.split(".")[0]] = this.constructor._require(join(dir, file));
  }

  /** EVENTS */

  async _loadEvents() {
    const time = now();
    this.client.eventHandlers.forEach((listener, event) => this.client.removeListener(event, listener));
    const [coreFiles, userFiles] = await Promise.all([
      this._traverse(this.coreDirs.events),
      this._traverse(this.clientDirs.events),
    ]);
    if (coreFiles) coreFiles.forEach(this._loadEvent.bind(this));
    if (userFiles) userFiles.forEach(this._loadEvent.bind(this));
    this.client.emit("log", `Loaded ${this.client.eventHandlers.size} events in ${this.constructor._friendlyDuration(now() - time)}`);
  }

  _loadEvent([dir, file]) {
    const name = file.split(".")[0];
    this.client.eventHandlers.set(name, (...args) => this.constructor._require(join(dir, file)).run(this.client, ...args));
    this.client.on(name, this.client.eventHandlers.get(name));
  }

  /** COMMANDS */
  async _loadCommands() {
    const time = now();
    this.client.commands.clear();
    this.client.aliases.clear();
    const [coreFiles, userFiles] = await Promise.all([
      this._traverse(this.coreDirs.commands),
      this._traverse(this.clientDirs.commands),
    ]);
    if (coreFiles) coreFiles.forEach(this._loadCommand.bind(this));
    if (userFiles) userFiles.forEach(this._loadCommand.bind(this));
    this.client.emit("log", `Loaded ${this.client.commands.size} with ${this.client.aliases.size} in ${this.constructor._friendlyDuration(now() - time)}`);
  }

  _loadCommand([dir, file]) {
    const command = this.constructor_require(join(dir, file));
    const dirArray = dir.split(sep);
    const fullCat = dirArray.splice(dirArray.indexOf("commands") + 1);
    command.help.fullCategory = fullCat.slice();
    const subcat = fullCat.splice(fullCat.length - 1)[0];
    const cat = fullCat.join("/");
    command.help.category = subcat && !cat ? subcat || "General" : cat || "General";
    command.help.subCategory = subcat || "General";
    command.cooldown = new Map();
    this.client.commands.set(command.help.name, command);
    command.conf.aliases = command.conf.aliases || [];
    command.conf.aliases.forEach(alias => this.client.aliases.set(alias, command.help.name));
    command.usage = new ParsedUsage(this.client, command);
  }


  get size() {
    return Object.keys(this).length;
  }

  static _friendlyDuration(time) {
    if (time >= 1000) return `${(time / 1000).toFixed(2)}s`;
    if (time >= 1) return `${time.toFixed(2)}ms`;
    return `${(time * 1000).toFixed(2)}μs`;
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
