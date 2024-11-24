import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookModel,
  NotebookPanel,
  INotebookTracker,
  NotebookActions
} from '@jupyterlab/notebook';

import { ICommandPalette } from '@jupyterlab/apputils';

import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IMainMenu } from '@jupyterlab/mainmenu';

import { Token } from '@lumino/coreutils';

enum CommandIDs {
  userGuide = 'help:userGuide',
  pythonHelp = 'help:pythonHelp',
  arcpyHelp = 'help:arcpyHelp'
}

export const JLExtension = new Token<IJLExtension>(
  'jupyter.extensions.jupyterlabext'
);

export type IJLExtension = DocumentRegistry.IWidgetExtension<
  NotebookPanel,
  INotebookModel
>;

const GLOBAL_STATE = {
  KERNEL: null as any,
  KERNEL_STATUS: null as any
};
let pollingTimer: any = null;

const plugin: JupyterFrontEndPlugin<IJLExtension> = {
  id: 'notebooks7-migrate:plugin',
  description:
    'A JupyterLab extension for migrating jupyter notebooks to JupyterLab',
  autoStart: true,
  requires: [INotebookTracker, ICommandPalette, IMainMenu],
  activate: async (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    palette: ICommandPalette,
    mainMenu: IMainMenu | null
  ) => {
    const { commands, docRegistry } = app;
    const extension = new NBExtension();
    docRegistry.addWidgetExtension('Notebook', extension);

    pollingWS();
    sendNotebookServerOSRequestMessage();

    function sendNotebookServerOSRequestMessage() {
      window.parent.postMessage(
        {
          messageType: 'NotebookServerOSRequestMessage'
        },
        '*'
      );
    }

    window.addEventListener('message', receiveMessage, false);

    function receiveMessage(event: any) {
      if (
        (event.data || {}).messageType === 'NotebookServerOSResponseMessage'
      ) {
        createHelp(event, tracker, commands, palette, mainMenu);
      }
      if ((event.data || {}).messageType === 'NotebookGetCellText') {
        getCellText(tracker);
      }
      if ((event.data || {}).messageType === 'NotebookMessage') {
        insertCodeBelow(event, tracker);
      }
      if ((event.data || {}).messageType === 'NotebookSaveMessage') {
        saveNotebook(tracker);
      }
      if ((event.data || {}).messageType === 'NotebookSaveAsMessage') {
        saveAsNotebook(tracker);
      }
      if ((event.data || {}).messageType === 'NotebookAddParameters') {
        insertCodeBelow(event, tracker, true);
      }
    }
    trackNBLoadedRemoved(tracker);

    return extension;
  }
};

async function createHelp(
  event: any,
  tracker: INotebookTracker,
  commands: any,
  palette: ICommandPalette,
  mainMenu: IMainMenu | null
) {
  const data = {
    serverOS: null,
    isPortal: null,
    notebookServerInfo: null
  };
  data.serverOS = event.data.message.serverOS;
  data.isPortal = event.data.message.isPortal;
  data.notebookServerInfo = await getNotebookServerInfo(event.data.message);
  createHelpMenus(
    tracker,
    commands,
    palette,
    mainMenu,
    data,
    event.data.message
  );
}

function addMenuHelpLinks(
  tracker: INotebookTracker,
  commands: any,
  palette: ICommandPalette,
  mainMenu: IMainMenu | null,
  labels: Array<string>,
  links: Array<string>
) {
  const group: any = [];
  const commandIDs = Object.values(CommandIDs);
  labels.forEach((label, idx) => {
    commands.addCommand(`${commandIDs[idx]}`, {
      label: label,
      caption: 'Opens the notebooks user guide',
      execute: () => {
        window.open(links[idx], '_blank');
      }
    });
    palette.addItem({
      command: `${commandIDs[idx]}`,
      category: 'Help'
    });
    group.push({ command: `${commandIDs[idx]}` });
  });
  mainMenu?.helpMenu.addGroup(group, -1);
}

async function getNotebookServerInfo(data: any) {
  let url = location.origin;

  if (data.isPortal) {
    const path = location.pathname.substring(1);
    const context = path.substring(0, path.indexOf('/'));
    url += '/' + context;
  }
  let urlInfo;
  try {
    const response = await fetch(url + '/rest/info?f=fson', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });
    urlInfo = await response.json();
  } catch (error) {
    return null;
  }
  return urlInfo;
}

function getContext() {
  const pathParts = window.location.pathname.split('/').filter(part => !!part);
  return pathParts.length ? pathParts[0] + '/' : '';
}

function createHelpMenus(
  tracker: INotebookTracker,
  commands: any,
  palette: ICommandPalette,
  mainMenu: IMainMenu | null,
  data: any,
  helpData: any
) {
  const context = getContext();
  const hyphenatedLocales = ['zh-CN', 'pt-BR'];
  const locale =
    hyphenatedLocales.indexOf(navigator.language) === -1
      ? navigator.language.split('-')[0]
      : navigator.language;
  const userGuideUrl = '/' + context + 'nbhelp/admin/' + locale + '/notebook/';
  const fallBackPythonApiHelpUrl = '/' + context + 'nbhelp/' + 'en' + '/python';

  // fallback arcpy help
  const version = (data.notebookServerInfo || {}).fullVersion;
  const arcPyHelpUrlFallback =
    userGuideUrl +
    version +
    '/python/' +
    data.serverOS +
    '/use-arcpy-in-your-notebook.htm';

  const notebookUserGuidHelp = helpData.notebookUserGuidHelp || userGuideUrl;
  const pythonApiHelpUrl =
    helpData.pythonApiHelpUrl || fallBackPythonApiHelpUrl;
  const arcPyHelpUrl = helpData.arcPyHelp || arcPyHelpUrlFallback;
  const helpArr = [notebookUserGuidHelp, pythonApiHelpUrl];

  if (helpData.arcPyHelp || data.serverOS) {
    helpArr.push(arcPyHelpUrl);
  }
  addMenuHelpLinks(
    tracker,
    commands,
    palette,
    mainMenu,
    ['ArcGIS Notebooks User Guide', 'ArcGIS API for Python Help', 'ArcPy Help'],
    helpArr
  );
}

function trackNBLoadedRemoved(tracker: INotebookTracker) {
  tracker.currentChanged.connect((INBTracker, NBPanel) => {
    if (!(NBPanel && tracker.currentWidget)) {
      window.parent.postMessage(
        {
          messageType: 'NoteBookMessage',
          message: {
            eventType: 'notebook_removed'
          }
        },
        '*'
      );
    }
  });
}

function getCellText(tracker: INotebookTracker) {
  const notebook: NotebookPanel | null = tracker.currentWidget;
  if (!notebook) {
    return;
  }
  const content = notebook.content;
  if (content) {
    const activeCell = content.activeCell;
    if (activeCell) {
      window.parent.postMessage(
        {
          messageType: 'ActiveCellText',
          message: {
            text: activeCell.model.sharedModel.getSource()
          }
        },
        '*'
      );
    }
  }
}

function insertCodeBelow(
  event: any,
  tracker: INotebookTracker,
  isParameter = false
) {
  const notebook: NotebookPanel | null = tracker.currentWidget;
  if (!notebook) {
    return;
  }
  const content = notebook.content;
  if (content) {
    NotebookActions.insertBelow(content);
    const activeCell = content.activeCell;
    if (activeCell) {
      activeCell.model.sharedModel.setSource(event.data.message);
      if (isParameter) {
        activeCell.model.setMetadata('tags', ['parameters']);
      }
    }
  }
}

function saveNotebook(tracker: INotebookTracker) {
  const notebook: NotebookPanel | null = tracker.currentWidget;
  if (!notebook) {
    return;
  }
  notebook.context.save();
}

function saveAsNotebook(tracker: INotebookTracker) {
  const notebook: NotebookPanel | null = tracker.currentWidget;
  if (!notebook) {
    return;
  }
  window.parent.postMessage(
    {
      messageType: 'NotebookJsonMessage',
      message: {
        notebookJson: notebook.context.model.toJSON()
      }
    },
    '*'
  );
}

let loaded_flag = false;

function pollingWS() {
  if (pollingTimer === null) {
    pollingTimer = setInterval(() => {
      if (GLOBAL_STATE.KERNEL && GLOBAL_STATE.KERNEL_STATUS === 'busy') {
        (GLOBAL_STATE.KERNEL as any).requestKernelInfo();
      }
    }, 540000);
  }
}

export class NBExtension implements IJLExtension {
  /**
   * Create a new extension object.
   */
  createNew(
    nb: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ) {
    // nb.model?.contentChanged.connect

    nb.content.stateChanged.connect(ev => {
      if (loaded_flag === false) {
        window.parent.postMessage(
          {
            messageType: 'NoteBookMessage',
            message: {
              eventType: 'notebook_loaded'
            }
          },
          '*'
        );
        loaded_flag = true;
      }
      if (ev.model?.dirty) {
        window.parent.postMessage(
          {
            messageType: 'DirtyStatusMessage',
            message: {
              dirty: ev.model?.dirty
            }
          },
          '*'
        );
      }
    });
    nb.context.saveState.connect((sender, state) => {
      if (state === 'completed') {
        window.parent.postMessage(
          {
            messageType: 'SavedStatusMessage',
            message: {
              saved: state === 'completed'
            }
          },
          '*'
        );
        getCheckpoints().then(res =>
          window.parent.postMessage(
            {
              messageType: 'CheckpointStatusMessage',
              message: {
                checkpoint: res
              }
            },
            '*'
          )
        );
      }
      if (state === 'failed') {
        window.parent.postMessage(
          {
            messageType: 'SaveFailedMessage'
          },
          '*'
        );
      }
    });
    nb.sessionContext.statusChanged.connect((sender, status) => {
      GLOBAL_STATE.KERNEL = nb.sessionContext.session?.kernel;
      GLOBAL_STATE.KERNEL_STATUS = status;
      window.parent.postMessage(
        {
          messageType: 'KernelStatusMessage',
          message: {
            eventType: status,
            kernelBusy: status === 'busy'
          }
        },
        '*'
      );
    });
    const getCheckpoints = async () => {
      return await context.listCheckpoints();
    };
    nb.sessionContext.connectionStatusChanged.connect((sender, status) => {
      if (status === 'connected') {
        getCheckpoints().then(res =>
          window.parent.postMessage(
            {
              messageType: 'InitialNotebookStatus',
              message: {
                dirty: nb.model?.dirty,
                checkpoints: res
              }
            },
            '*'
          )
        );
      }
    });
  }
}
export default plugin;
