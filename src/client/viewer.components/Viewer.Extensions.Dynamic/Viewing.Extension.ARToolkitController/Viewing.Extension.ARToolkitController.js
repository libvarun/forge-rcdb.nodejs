///////////////////////////////////////////////////////////
// ARToolkitController Viewer Extension
// By Philippe Leefsma, Autodesk Inc, July 2017
//
///////////////////////////////////////////////////////////
import {ReflexContainer, ReflexElement, ReflexSplitter} from 'react-reflex'
import MultiModelExtensionBase from 'Viewer.MultiModelExtensionBase'
import ARVRToolkitAPI from './ARVRToolkit.API'
import DerivativesAPI from './Derivatives.API'
import WidgetContainer from 'WidgetContainer'
import { browserHistory } from 'react-router'
import { Tabs, Tab } from 'react-bootstrap'
import ManifestView from './ManifestView'
import NewSceneView from './NewSceneView'
import ServiceManager from 'SvcManager'
import ScenesView from './ScenesView'
import { ReactLoader } from 'Loader'
import Measure from 'react-measure'
import DOMPurify from 'dompurify'
import ReactDOM from 'react-dom'
import Image from 'Image'
import Label from 'Label'
import React from 'react'

class ARToolkitControllerExtension extends MultiModelExtensionBase {

  /////////////////////////////////////////////////////////
	// Class constructor
  //
  /////////////////////////////////////////////////////////
	constructor (viewer, options) {

		super (viewer, options)

    this.onItemNodeCreated = this.onItemNodeCreated.bind(this)
    this.onSceneDeleted = this.onSceneDeleted.bind(this)
    this.onTabSelected = this.onTabSelected.bind(this)

    this.derivativesAPI = new DerivativesAPI({
      apiUrl: this.options.derivativesApiUrl
    })

    this.arvrToolkitAPI = new ARVRToolkitAPI({
      apiUrl: this.options.toolkitApiUrl
    })

    this.notifySvc =
      ServiceManager.getService(
        'NotifySvc')

    this.modelSvc =
      ServiceManager.getService(
        'ModelSvc')

    this.dialogSvc =
      ServiceManager.getService(
        'DialogSvc')

    this.forgeSvc =
      ServiceManager.getService(
        'ForgeSvc')

    this.userSvc =
      ServiceManager.getService(
        'UserSvc')

    this.react = options.react
	}

	/////////////////////////////////////////////////////////
	// Load callback
  //
  /////////////////////////////////////////////////////////
	load () {

    this.options.loader.show(false)

    if (!this.viewer.model) {

      this.viewer.container.classList.add('empty')
    }

    this.react.setState({

      selectedModel: null,
      hierarchy: null,
      manifest: null,
      tabsWidth: 0,
      scenes: null,
      models: [],
      guid: null

    }).then (async() => {

      await this.react.pushRenderExtension(this)

      if (this.options.auth === '3legged') {

        const dmReactOptions = {
          pushRenderExtension: () => {
            return Promise.resolve()
          },
          popRenderExtension: () => {
            return Promise.resolve()
          }
        }

        const dmExtension =
          await this.viewer.loadDynamicExtension(
            'Viewing.Extension.DataManagement', {
            react: dmReactOptions
          })

        dmExtension.on('item.created', this.onItemNodeCreated)

        await this.react.setState({
          dmExtension
        })

      } else {

        const models =
          await this.modelSvc.getModels(
          this.options.database)

        this.react.setState({
          models
        })
      }
    })

    console.log('Viewing.Extension.ARToolkitController loaded')

		return true
	}

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  get className() {

    return 'ar-vr-toolkit'
  }

  /////////////////////////////////////////////////////////
	// Extension Id
  //
  /////////////////////////////////////////////////////////
	static get ExtensionId () {

		return 'Viewing.Extension.ARToolkitController'
	}

  /////////////////////////////////////////////////////////
	// Unload callback
  //
  /////////////////////////////////////////////////////////
	unload () {

    console.log('Viewing.Extension.ARToolkitController loaded')

    super.unload ()

		return true
	}

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async setDocking (docked) {

    const id = ARToolkitControllerExtension.ExtensionId

    if (docked) {

      await this.react.popRenderExtension(id)

      this.react.pushViewerPanel(this, {
        height: 250,
        width: 350
      })

    } else {

      await this.react.popViewerPanel(id)

      this.react.pushRenderExtension(this)
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  showLogin () {

    const onClose = (result) => {

      this.dialogSvc.off('dialog.close', onClose)

      if (result === 'OK') {

        this.forgeSvc.login()
        return
      }

      browserHistory.push('/configurator')
    }

    this.dialogSvc.on('dialog.close', onClose)

    this.dialogSvc.setState({
      onRequestClose: () => {},
      className: 'login-dlg',
      title: 'Forge Login required ...',
      content:
        <div>
          Press OK to login ...
        </div>,
      open: true
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onItemNodeCreated (node) {

    node.setControl({

      tooltip: 'Load AR/VR Toolkit scenes ...',
      className: 'fa fa-cubes',
      onClick: () => {

        this.selectModel({
          versionId: node.activeVersion.id,
          projectId: node.props.projectId,
          urn: node.viewerUrn,
          name: node.name
        })
      }
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  selectModel (model) {

    this.react.setState({
      selectedModel: model,
      hierarchy: null,
      manifest: null,
      scenes: null
    })

    this.arvrToolkitAPI.getManifest(model.urn).then(
      (manifest) => {

        const scenes =
          this.arvrToolkitAPI.getManifestScenes(
            manifest)

        this.react.setState({
          manifest,
          scenes
        })
      })

    this.derivativesAPI.getMetadata(model.urn).then(
      (metadata) => {

        if (metadata.data.metadata.length) {

          const {guid} = metadata.data.metadata[0]

          this.derivativesAPI.getHierarchy(
            model.urn, guid).then(
            (hierarchy) => {

              this.react.setState({
                hierarchy,
                guid
              })
            })
        }
      })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onTabSelected (tabKey) {

    this.react.setState({
      activeTabKey: tabKey
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderModels () {

    const {models, selectedModel} = this.react.getState()

    const modelItems = models.map((dbModel) => {

      const thumbnailUrl = this.modelSvc.getThumbnailUrl(
        this.options.database, dbModel._id, 200)

      const urn = selectedModel? selectedModel.urn : ''

      const active = (urn === dbModel.model.urn)
        ? ' active' : ''

      return (
        <div className={"model-item" + active}
          key={dbModel._id}
          onClick={() => {
            this.selectModel({
              urn: dbModel.model.urn,
              name: dbModel.name
            })
          }}>
          <Image src={thumbnailUrl}/>
          <Label text= {dbModel.name}/>
        </div>
      )
    })

    return (
      <WidgetContainer
        title="Select model to use with the AR/VR Toolkit"
        showTitle={true}>

        <div className="models">
          { modelItems }
        </div>

      </WidgetContainer>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderControls () {

    const {activeTabKey, selectedModel, tabsWidth} =
      this.react.getState()

    const widgetTitle = 'Model: ' +
      selectedModel.name

    const nbTabs = 3

    const style = {
      width:
        `${Math.floor((tabsWidth-8)/nbTabs-15)}px`
    }

    const tabTitle = (title) => {
       return (
        <label style={style}>
          {title}
        </label>
       )
    }

    return (
      <WidgetContainer
        className={this.className}
        title={widgetTitle}
        showTitle={true}>
        <Measure bounds onResize={(rect) => {
          this.react.setState({
            tabsWidth: rect.bounds.width
          })
        }}>
        {
          ({ measureRef }) =>
            <div ref={measureRef} className="tabs-container">
              <Tabs activeKey={activeTabKey}
                onSelect={this.onTabSelected}
                id="derivatives-tab"
                className="tabs">
                <Tab className="tab-container"
                  title={tabTitle('Manifest')}
                  eventKey="manifest"
                  key="manifest">
                  { this.renderManifestTab ()}
                </Tab>
                <Tab className="tab-container"
                  title={tabTitle('Scenes')}
                  eventKey="scenes"
                  key="scenes">
                  { this.renderScenesTab ()}
                </Tab>
                <Tab className="tab-container"
                  title={tabTitle('New Scene')}
                  eventKey="new-scene"
                  key="ew-scene">
                  { this.renderNewSceneTab () }
                </Tab>
              </Tabs>
            </div>
          }
        </Measure>
      </WidgetContainer>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderManifestTab () {

    const {manifest} = this.react.getState()

    return (
      <ManifestView manifest={manifest}/>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onSceneDeleted () {

    const {selectedModel} = this.react.getState()

    this.react.setState({
      manifest: null,
      scenes: null
    })

    const urn = selectedModel.urn

    this.arvrToolkitAPI.getManifest(urn).then(
      (manifest) => {

        const scenes =
          this.arvrToolkitAPI.getManifestScenes(
            manifest)

        this.react.setState({
          manifest,
          scenes
        })
      })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderScenesTab () {

    const {scenes, selectedModel} = this.react.getState()

    return (
      <ScenesView
        onSceneDeleted={this.onSceneDeleted}
        arvrToolkitAPI={this.arvrToolkitAPI}
        notifySvc={this.notifySvc}
        model={selectedModel}
        scenes={scenes}
      />
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderNewSceneTab () {

    const {hierarchy, selectedModel} = this.react.getState()

    return (
      <NewSceneView
        arvrToolkitAPI={this.arvrToolkitAPI}
        notifySvc={this.notifySvc}
        hierarchy= {hierarchy}
        model={selectedModel}
      />
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderContent () {

    const {
      selectedModel,
      dmExtension,
      models
    } = this.react.getState()

    const showModelSelector = (this.options.auth === '2legged')

    const showLoader = showModelSelector && !models.length

    return (
      <div className="content">
        <ReactLoader show={showLoader}/>
        <ReflexContainer>
          {
            showModelSelector &&
            <ReflexElement minSize={39}>
            { this.renderModels() }
            </ReflexElement>
          }
          {
            showModelSelector &&
            selectedModel &&
            <ReflexSplitter/>
          }
          {
            dmExtension &&
            <ReflexElement minSize={39}>
              <WidgetContainer
                title="Select item to use with the AR/VR Toolkit"
                showTitle={true}>
                { dmExtension.render() }
              </WidgetContainer>
            </ReflexElement>
          }
          {
            selectedModel &&
            dmExtension &&
            <ReflexSplitter/>
          }
          {
            selectedModel &&
            <ReflexElement minSize={39} flex={0.72}>
              { this.renderControls () }
            </ReflexElement>
          }
        </ReflexContainer>
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  render (opts) {

    return (
      <WidgetContainer
        className={this.className}
        showTitle={false}>
        { this.renderContent () }
      </WidgetContainer>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension (
  ARToolkitControllerExtension.ExtensionId,
  ARToolkitControllerExtension)

export default 'Viewing.Extension.ARToolkitController'
