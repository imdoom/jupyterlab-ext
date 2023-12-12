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

import { ILauncher } from '@jupyterlab/launcher';

import { Token } from '@lumino/coreutils';

/**
 * Initialization data for the jupyterlab_nb extension.
 */

namespace CommandIDs {
  export const newCell = 'cell:new';
}

/**
 * The token identifying the JupyterLab plugin.
 */

export type IJLExtension = DocumentRegistry.IWidgetExtension<
  NotebookPanel,
  INotebookModel
>;
export const JLExtension = new Token<IJLExtension>(
  'jupyter.extensions.jupyterlabext'
);

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_nb:plugin',
  description:
    'A JupyterLab extension for migrating jupyter notebooks to JupyterLab',
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    palette: ICommandPalette | null,
    launcher: ILauncher | null
  ) => {
    const { commands } = app;

    // Recreate views from layout restorer

    window.addEventListener('message', receiveMessage, false);

    function receiveMessage(event: any) {
      if ((event.data || {}).messageType === 'NotebookMessage') {
        addCommands(app, tracker, palette, launcher);
      }
    }

    if (launcher) {
      launcher.add({
        command: CommandIDs.newCell,
        category: 'new cell'
      });
    }
    function refreshNewCommand() {
      commands.notifyCommandChanged(CommandIDs.newCell);
    }
    // Update the command registry when the notebook state changes.
    tracker.currentChanged.connect(refreshNewCommand);

    let prevWidget: NotebookPanel | null = tracker.currentWidget;
    if (prevWidget) {
      prevWidget.context.sessionContext.kernelChanged.connect(
        refreshNewCommand
      );
    }
    tracker.currentChanged.connect(tracker => {
      if (prevWidget) {
        prevWidget.context.sessionContext.kernelChanged.disconnect(
          refreshNewCommand
        );
      }
      prevWidget = tracker.currentWidget;
      if (prevWidget) {
        prevWidget.context.sessionContext.kernelChanged.connect(
          refreshNewCommand
        );
      }
    });
  }
};

function addCommands(
  app: JupyterFrontEnd,
  tracker: INotebookTracker,
  palette: ICommandPalette | null,
  launcher: ILauncher | null
): void {
  const { commands } = app;
  console.log('adding cells');
  commands.addCommand(CommandIDs.newCell, {
    label: 'New cell',
    caption: 'Add new cell with data',
    execute: async args => {
      let notebook: NotebookPanel | null;
      if (args.path) {
        notebook = tracker.find(nb => nb.context.path === args.path) ?? null;
      } else {
        notebook = tracker.currentWidget;
      }
      if (!notebook) {
        return;
      }
      const content = notebook.content;
      if (content) {
        NotebookActions.insertBelow(content);
        const activeCell = content.activeCell;
        if (activeCell) {
          activeCell.model.sharedModel.setSource('new cell data');
          activeCell.model.setMetadata('tags', ['tag_test1', 'tag_test2']);
        }
        content.activeCellChanged.connect((slot, cell) =>
          console.log('active cell text: ', cell?.model.sharedModel.getSource())
        );
      }
    }
  });

  palette?.addItem({
    command: CommandIDs.newCell,
    category: 'Cell'
  });
}
export default plugin;
