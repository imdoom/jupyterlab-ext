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

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { Token } from '@lumino/coreutils';

export const JLExtension = new Token<IJLExtension>(
  'jupyter.extensions.jupyterlabext'
);

export type IJLExtension = DocumentRegistry.IWidgetExtension<
  NotebookPanel,
  INotebookModel
>;

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_nb:plugin',
  description:
    'A JupyterLab extension for migrating jupyter notebooks to JupyterLab',
  autoStart: true,
  requires: [INotebookTracker],
  activate: async (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    window.addEventListener('message', receiveMessage, false);
    function receiveMessage(event: any) {
      if ((event.data || {}).messageType === 'NotebookMessage') {
        const notebook: NotebookPanel | null = tracker.currentWidget;
        if (!notebook) {
          return;
        }
        const content = notebook.content;
        if (content) {
          NotebookActions.insertAbove(content);
          const activeCell = content.activeCell;
          if (activeCell) {
            activeCell.model.sharedModel.setSource(event.data.message);
          }
          // content.activeCellChanged.connect((slot, cell) =>
          //   console.log(
          //     'active cell text: ',
          //     cell?.model.sharedModel.getSource()
          //   )
          // );
        }
      }
    }
  }
};
export default plugin;
