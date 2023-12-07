import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab_nb extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_nb:plugin',
  description: 'A JupyterLab extension for migrating jupyter notebooks to JupyterLab',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab_nb is activated!');
  }
};

export default plugin;
