import { assignHostContentSlots } from '../core/renderer/slot';
import { ModuleCallbacks, ComponentMeta, ComponentRegistry, ConfigApi,
  DomApi, DomControllerApi, FilesMap, Logger, HostElement, ListenOptions,
  PlatformApi, ProjectGlobal, StencilSystem } from '../util/interfaces';
import { createRenderer } from '../core/renderer/patch';
import { generateGlobalContext } from './global-context';
import { getMode } from '../core/platform/mode';
import { h, t } from '../core/renderer/h';
import { initGlobal } from './global-server';
import { parseComponentMeta } from '../util/data-parse';


export function createPlatformServer(
  sys: StencilSystem,
  logger: Logger,
  projectNamespace: string,
  Gbl: ProjectGlobal,
  win: Window,
  domApi: DomApi,
  config: ConfigApi,
  dom: DomControllerApi,
  projectBuildDir: string
): PlatformApi {
  const registry: ComponentRegistry = { 'HTML': {} };
  const moduleImports: {[tag: string]: any} = {};
  const moduleCallbacks: ModuleCallbacks = {};
  const loadedModules: {[moduleId: string]: boolean} = {};
  const pendingModuleFileReads: {[url: string]: boolean} = {};
  const pendingStyleFileReads: {[url: string]: boolean} = {};
  const stylesMap: FilesMap = {};


  const plt: PlatformApi = {
    defineComponent,
    getComponentMeta,
    loadBundle,
    connectHostElement,
    config,
    queue: Gbl.QueueCtrl,
    tmpDisconnected: false,
    isServer: true,
    getEventOptions
  };

  // create the renderer which will be used to patch the vdom
  plt.render = createRenderer(plt, domApi);

  const injectedGlobal = initGlobal(config, dom);

  // generate a sandboxed context
  const context = generateGlobalContext(win);

  // add the project's global to the context
  context[projectNamespace] = Gbl;

  // create the sandboxed context
  sys.vm.createContext(context);


  // setup the root node of all things
  // which is the mighty <html> tag
  const rootNode = <HostElement>domApi.$documentElement;
  rootNode._activelyLoadingChildren = [];
  rootNode._initLoad = function appLoadedCallback() {
    // check we've only fully loaded when all of the styles have loaded also
    if (plt.onAppLoad && Object.keys(pendingStyleFileReads).length === 0) {
      rootNode._hasLoaded = true;

      plt.onAppLoad(rootNode, stylesMap);
    }
  };

  function connectHostElement(elm: HostElement, slotMeta: number) {
    assignHostContentSlots(domApi, elm, slotMeta);
  }


  function getComponentMeta(elm: Element) {
    return registry[elm.tagName];
  }

  function defineComponent(cmpMeta: ComponentMeta) {
    registry[cmpMeta.tagNameMeta] = cmpMeta;

    if (cmpMeta.componentModuleMeta) {
      // for unit testing
      moduleImports[cmpMeta.tagNameMeta] = cmpMeta.componentModuleMeta;
    }
  }


  Gbl.defineComponents = function defineComponents(module, importFn) {
    const args = arguments;

    // import component function
    // inject globals
    importFn(moduleImports, h, t, injectedGlobal);

    for (var i = 2; i < args.length; i++) {
      parseComponentMeta(registry, moduleImports, args[i]);
    }

    // fire off all the callbacks waiting on this bundle to load
    var callbacks = moduleCallbacks[module];
    if (callbacks) {
      for (i = 0; i < callbacks.length; i++) {
        callbacks[i]();
      }
      delete moduleCallbacks[module];
    }

    // remember that we've already loaded this bundle
    loadedModules[module] = true;
  };


  function loadBundle(cmpMeta: ComponentMeta, elm: HostElement, cb: Function): void {
    if (cmpMeta.componentModuleMeta) {
      // we already have the module loaded
      // (this is probably a unit test)
      cb();
      return;
    }

    const moduleId = cmpMeta.moduleId;

    if (loadedModules[moduleId]) {
      // sweet, we've already loaded this module
      cb();

    } else {
      // never seen this module before, let's start loading the file
      // and add it to the bundle callbacks to fire when it's loaded
      if (moduleCallbacks[moduleId]) {
        moduleCallbacks[moduleId].push(cb);
      } else {
        moduleCallbacks[moduleId] = [cb];
      }

      // create the module filePath we'll be reading
      const moduleFilePath = sys.path.join(projectBuildDir, `${moduleId}.js`);

      if (!pendingModuleFileReads[moduleFilePath]) {
        // not already actively reading this file
        // remember that we're now actively requesting this url
        pendingModuleFileReads[moduleFilePath] = true;

        // let's kick off reading the module
        sys.fs.readFile(moduleFilePath, 'utf-8', (err, code) => {
          delete pendingModuleFileReads[moduleFilePath];

          if (err) {
            logger.error(`loadBundle, module read: ${err}`);
            throw err;

          } else {
            // run the code in this sandboxed context
            sys.vm.runInContext(code, context, { timeout: 5000 });
          }
        });
      }

      // we also need to load this component's css file
      const styleId = cmpMeta.styleIds[getMode(domApi, config, elm)] || cmpMeta.styleIds.$;
      if (styleId) {
        // we've got a style id to load up
        // create the style filePath we'll be reading
        const styleFilePath = sys.path.join(projectBuildDir, `${styleId}.css`);

        if (!stylesMap[styleFilePath]) {
          // this style hasn't been added to our collection yet

          if (!pendingStyleFileReads[styleFilePath]) {
            // we're not already actively opening this file
            pendingStyleFileReads[styleFilePath] = true;

            sys.fs.readFile(styleFilePath, 'utf-8', (err, styleContent) => {
              delete pendingStyleFileReads[styleFilePath];

              if (err) {
                logger.error(`loadBundle, style read: ${err}`);

              } else {
                // finished reading the css file
                // let's add the content to our collection
                stylesMap[styleFilePath] = styleContent;

                // check if the entire app is done loading or not
                // and if this was the last thing the app was waiting on
                rootNode._initLoad();
              }
            });
          }
        }
      }
    }
  }

  function getEventOptions(opts: ListenOptions) {
    return {
      'capture': !!(opts && opts.capture),
      'passive': !(opts && opts.passive === false)
    };
  }

  return plt;
}