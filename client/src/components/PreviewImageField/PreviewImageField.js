/* global window, FormData */
import i18n from 'i18n';
import React, { Component } from 'react';
import AssetDropzone from 'components/AssetDropzone/AssetDropzone';
import CONSTANTS from 'constants/index';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { formValueSelector } from 'redux-form';
import * as previewFieldActions from 'state/previewField/PreviewFieldActions';
import { getFileExtension } from 'lib/DataFormat';
import getFormState from 'lib/getFormState';
import classnames from 'classnames';
import PropTypes from 'prop-types';

class PreviewImageField extends Component {
  constructor(props) {
    super(props);

    this.handleAddedFile = this.handleAddedFile.bind(this);
    this.handleFailedUpload = this.handleFailedUpload.bind(this);
    this.handleSuccessfulUpload = this.handleSuccessfulUpload.bind(this);
    this.handleSending = this.handleSending.bind(this);
    this.handleUploadProgress = this.handleUploadProgress.bind(this);
    this.handleCancelUpload = this.handleCancelUpload.bind(this);
    this.handleRemoveErroredUpload = this.handleRemoveErroredUpload.bind(this);
    this.canFileUpload = this.canFileUpload.bind(this);
    this.updateFormData = this.updateFormData.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    // Check latest version to detect file save actions
    if (
      (this.props.data.url && nextProps.data.url !== this.props.data.url)
      || (this.props.data.version && nextProps.data.version !== this.props.data.version)
    ) {
      this.props.actions.previewField.removeFile(this.props.id);
    }
  }

  componentWillUnmount() {
    this.props.actions.previewField.removeFile(this.props.id);
  }

  getDropzoneProps() {
    const endpoint = this.props.data.uploadFileEndpoint;
    const name = this.props.name;
    const options = {
      url: endpoint && endpoint.url,
      method: endpoint && endpoint.method,
      paramName: 'Upload',
      clickable: true,
      maxFiles: 1,
    };
    const preview = {
      height: CONSTANTS.THUMBNAIL_HEIGHT,
      width: CONSTANTS.THUMBNAIL_WIDTH,
    };
    const securityID = this.props.securityID;

    const classNames = [
      'asset-dropzone--button',
      'preview-image-field__container',
      this.props.className,
      this.props.extraClass,
    ];

    return {
      name,
      className: classNames.join(' '),
      canUpload: endpoint && this.canEdit(),
      preview,
      folderId: this.props.data.parentid,
      options,
      securityID,
      uploadButton: false,
      onAddedFile: this.handleAddedFile,
      onError: this.handleFailedUpload,
      onSuccess: this.handleSuccessfulUpload,
      onSending: this.handleSending,
      onUploadProgress: this.handleUploadProgress,
      canFileUpload: this.canFileUpload,
      updateFormData: this.updateFormData,
    };
  }

  getButtonClasses(type) {
    return classnames([
      `preview-image-field__toolbar-button--${type}`,
      'preview-image-field__toolbar-button'
    ]);
  }

  /**
   * Invoked by AssetDropZone to decorate additional form data fields
   * posted to the AssetAdmin::apiUploadFile endpoint.
   *
   * @param {FormData} formData
   */
  updateFormData(formData) {
    formData.append('ID', this.props.data.id);
    formData.append('Name', this.props.nameValue);
  }

  /**
   * Started the sending process for a file
   *
   * @param {object} file
   * @param {object} xhr
   */
  handleSending(file, xhr) {
    this.props.actions.previewField.updateFile(this.props.id, { xhr });
  }

  /**
   * Update tuple detail fields when upload is successful.
   *
   * @param fileXhr
   */
  handleSuccessfulUpload(fileXhr) {
    const json = JSON.parse(fileXhr.xhr.response);

    if (typeof this.props.onAutofill === 'function') {
      this.props.onAutofill('FileFilename', json.Filename);
      this.props.onAutofill('FileHash', json.Hash);
      this.props.onAutofill('FileVariant', json.Variant);

      // Note: This Name was posted back from the current form field value,
      // and may have been modified on the server. If so, update the form value
      if (json.Name) {
        this.props.onAutofill(this.props.data.nameField, json.Name);
      }
    }
  }

  handleFailedUpload(file, response) {
    this.props.actions.previewField.failUpload(this.props.id, response);
  }

  /**
   * Handles when a file is added to this field.
   *
   * @param {object} data
   */
  handleAddedFile(data) {
    this.props.actions.previewField.addFile(this.props.id, data);
  }

  /**
   * Handles removing an upload that had errored during/after upload
   */
  handleRemoveErroredUpload() {
    // revert to initial values so errored or replaced replacement doesn't get used
    if (typeof this.props.onAutofill === 'function') {
      const initial = this.props.data.initialValues;

      this.props.onAutofill('FileFilename', initial.FileFilename);
      this.props.onAutofill('FileHash', initial.FileHash);
      this.props.onAutofill('FileVariant', initial.FileVariant);
    }

    this.props.actions.previewField.removeFile(this.props.id);
  }

  /**
   * Handles removing an upload and cancelling the request made to upload
   */
  handleCancelUpload() {
    if (this.props.upload.xhr) {
      this.props.upload.xhr.abort();
    }
    this.handleRemoveErroredUpload();
  }

  /**
   *
   * @param {File} file
   * @returns {boolean}
   */
  canFileUpload(file) {
    const prevName = this.props.data.initialValues.FileFilename;
    const prevExt = getFileExtension(prevName);
    const nextExt = getFileExtension(file.name);

    if (!prevExt || prevExt === nextExt) {
      return true;
    }

    const message = i18n._t(
      'AssetAdmin.CONFIRM_CHANGE_EXTENSION',
      'Are you sure you want upload a file with a different extension?'
    );

    return this.props.confirm(message);
  }

  preventDefault(e) {
    e.preventDefault();
  }

  /**
   * Defines whether this field can make changes/edits/uploads, looks at readonly, disabled and if
   * the file category is a "folder"
   *
   * @returns {boolean}
   */
  canEdit() {
    return !this.props.readOnly
      && !this.props.disabled
      && this.props.data.category !== 'folder';
  }

  /**
   * Upload progress has changed, set changes to reflect it
   *
   * @param {object} file
   * @param {object} progress
   */
  handleUploadProgress(file, progress) {
    this.props.actions.previewField.updateFile(this.props.id, { progress });
  }

  /**
   * Build the preview URL
   * @param {string} category
   * @param {object} upload
   * @param {object} data
   * @returns {string}
   */
  preview(category, upload, data) {
    if (category && category !== 'image') {
      return CONSTANTS.DEFAULT_PREVIEW;
    }
    const url = upload.url || data.preview || data.url;
    if (url) {
      return (!data.version || url.startsWith('data:image/')) ?
        url : `${url}?vid=${data.version}`;
    }

    return null;
  }

  /**
   * Renders the image markup as normal by LiteralField
   *
   * @returns {object}
   */
  renderImage() {
    const { data, upload } = this.props;

    // if not mocking the preview image (with icon), doesn't exist and no upload url...
    if (!data.mock && !data.exists && !upload.url) {
      return (
        <div className="editor__file-preview-message--file-missing">
          {i18n._t('AssetAdmin.FILE_MISSING', 'File cannot be found')}
        </div>
      );
    }

    const { category, progress, message } = upload;
    const preview = this.preview(category, upload, data);
    const image = <img alt="preview" src={preview} className="editor__thumbnail" />;
    const linkedImage = (data.url && !progress) ? (
      <a
        className="editor__file-preview-link"
        href={`${data.url}?vid=${data.version}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {image}
      </a>
    ) : null;
    const progressBar = (progress > 0 && progress < 100) ? (
      <div className="preview-image-field__progress">
        <div className="preview-image-field__progress-bar" style={{ width: `${progress}%` }} />
      </div>
    ) : null;
    let messageBox = null;

    if (message) {
      messageBox = (
        <div className={`preview-image-field__message preview-image-field__message--${message.type}`}>
          {message.value}
        </div>
      );
    } else if (progress === 100) {
      messageBox = (
        <div className="preview-image-field__message preview-image-field__message--success">
          {i18n._t(
            'AssetAdmin.REPlACE_FILE_SUCCESS',
            'Upload successful, the file will be replaced when you Save.'
          )}
          {(progress || message) && (
            <button
              onClick={this.handleCancelUpload}
              className="preview-image-field__message-button btn btn-outline-light"
              type="button"
            >{i18n._t('AssetAdmin.REPLACE_FILE_UNDO', 'Undo')}</button>
          )}
        </div>
      );
    }

    return (
      <div className="editor__thumbnail-container">
        {linkedImage || image}
        {progressBar}
        {messageBox}
      </div>
    );
  }

  render() {
    const dropzoneProps = this.getDropzoneProps();

    if (this.canEdit()) {
      return (
        <AssetDropzone {...dropzoneProps}>
          {this.renderImage()}
        </AssetDropzone>
      );
    }
    const classNames = [
      'preview-image-field__container',
      this.props.className,
      this.props.extraClass,
    ];

    return (
      <div className={classNames.join(' ')}>
        {this.renderImage()}
      </div>
    );
  }
}

PreviewImageField.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  className: PropTypes.string,
  extraClass: PropTypes.string,
  readOnly: PropTypes.bool,
  disabled: PropTypes.bool,
  onAutofill: PropTypes.func,
  formid: PropTypes.string,
  nameValue: PropTypes.string,
  data: PropTypes.shape({
    id: PropTypes.number,
    parentid: PropTypes.number,
    version: PropTypes.number,
    url: PropTypes.string,
    mock: PropTypes.bool,
    exists: PropTypes.bool,
    preview: PropTypes.string,
    category: PropTypes.string,
    nameField: PropTypes.string,
    uploadFileEndpoint: PropTypes.shape({
      url: PropTypes.string.isRequired,
      method: PropTypes.string.isRequired,
      payloadFormat: PropTypes.string,
    }),
    initialValues: PropTypes.object,
  }).isRequired,
  upload: PropTypes.shape({
    url: PropTypes.string,
    progress: PropTypes.number,
    xhr: PropTypes.object,
    category: PropTypes.string,
    message: PropTypes.shape({
      type: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    }),
  }),
  actions: PropTypes.object,
  securityID: PropTypes.string,
  confirm: PropTypes.func,
};

PreviewImageField.defaultProps = {
  // React considers "undefined" as an uncontrolled component.
  extraClass: '',
  className: '',
  data: {},
  upload: {},
  // eslint-disable-next-line no-alert
  confirm: (msg) => window.confirm(msg),
};

function mapStateToProps(state, ownProps) {
  const securityID = state.config.SecurityID;
  const id = ownProps.id;
  const upload = state.assetAdmin.previewField[id] || {};
  const selector = formValueSelector(ownProps.formid, getFormState);

  return {
    securityID,
    upload,
    nameValue: selector(state, 'Name'),
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: {
      previewField: bindActionCreators(previewFieldActions, dispatch),
    },
  };
}

export { PreviewImageField as Component };

export default connect(mapStateToProps, mapDispatchToProps)(PreviewImageField);
