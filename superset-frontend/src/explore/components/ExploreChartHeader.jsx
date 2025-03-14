/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import Icons from 'src/components/Icons';
import { styled, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import ReportModal from 'src/components/ReportModal';
import {
  fetchUISpecificReport,
  toggleActive,
  deleteActiveReport,
} from 'src/reports/actions/reports';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import HeaderReportActionsDropdown from 'src/components/ReportModal/HeaderReportActionsDropdown';
import { chartPropShape } from '../../dashboard/util/propShapes';
import ExploreActionButtons from './ExploreActionButtons';
import RowCountLabel from './RowCountLabel';
import EditableTitle from '../../components/EditableTitle';
import AlteredSliceTag from '../../components/AlteredSliceTag';
import FaveStar from '../../components/FaveStar';
import Timer from '../../components/Timer';
import CachedLabel from '../../components/CachedLabel';
import PropertiesModal from './PropertiesModal';
import { sliceUpdated } from '../actions/exploreActions';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
  ownState: PropTypes.object,
  timeout: PropTypes.number,
  chart: chartPropShape,
};

const StyledHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;

  span[role='button'] {
    display: flex;
    height: 100%;
  }

  .title-panel {
    display: flex;
    align-items: center;
  }

  .right-button-panel {
    display: flex;
    align-items: center;

    > .btn-group {
      flex: 0 0 auto;
      margin-left: ${({ theme }) => theme.gridUnit}px;
    }
  }

  .action-button {
    margin: 0 ${({ theme }) => theme.gridUnit * 1.5}px 0
      ${({ theme }) => theme.gridUnit}px;
  }
`;

const StyledButtons = styled.span`
  display: flex;
  align-items: center;
`;

export class ExploreChartHeader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isPropertiesModalOpen: false,
      showingReportModal: false,
    };
    this.openPropertiesModal = this.openPropertiesModal.bind(this);
    this.closePropertiesModal = this.closePropertiesModal.bind(this);
    this.showReportModal = this.showReportModal.bind(this);
    this.hideReportModal = this.hideReportModal.bind(this);
    this.renderReportModal = this.renderReportModal.bind(this);
  }

  componentDidMount() {
    const { user, chart } = this.props;
    if (user && isFeatureEnabled(FeatureFlag.ALERT_REPORTS)) {
      // this is in the case that there is an anonymous user.
      this.props.fetchUISpecificReport(
        user.userId,
        'chart_id',
        'charts',
        chart.id,
      );
    }
  }

  getSliceName() {
    return this.props.sliceName || t('%s - untitled', this.props.table_name);
  }

  postChartFormData() {
    this.props.actions.postChartFormData(
      this.props.form_data,
      true,
      this.props.timeout,
      this.props.chart.id,
      this.props.ownState,
    );
  }

  openPropertiesModal() {
    this.setState({
      isPropertiesModalOpen: true,
    });
  }

  closePropertiesModal() {
    this.setState({
      isPropertiesModalOpen: false,
    });
  }

  showReportModal() {
    this.setState({ showingReportModal: true });
  }

  hideReportModal() {
    this.setState({ showingReportModal: false });
  }

  renderReportModal() {
    const attachedReportExists = !!Object.keys(this.props.reports).length;
    const canAddReports = isFeatureEnabled(FeatureFlag.ALERT_REPORTS);
    return (
      (canAddReports || null) &&
      (attachedReportExists ? (
        <HeaderReportActionsDropdown
          showReportModal={this.showReportModal}
          hideReportModal={this.hideReportModal}
          toggleActive={this.props.toggleActive}
          deleteActiveReport={this.props.deleteActiveReport}
        />
      ) : (
        <>
          <span
            role="button"
            title={t('Schedule email report')}
            tabIndex={0}
            className="action-button"
            onClick={this.showReportModal}
          >
            <Icons.Calendar />
          </span>
        </>
      ))
    );
  }

  canAddReports() {
    const { user } = this.props;
    if (!user) {
      // this is in the case that there is an anonymous user.
      return false;
    }
    const roles = Object.keys(user.roles || []);
    const permissions = roles.map(key =>
      user.roles[key].filter(
        perms => perms[0] === 'can_add' && perms[1] === 'AlertModelView',
      ),
    );
    return permissions[0].length > 0;
  }

  render() {
    const { user, form_data: formData } = this.props;
    const {
      chartStatus,
      chartUpdateEndTime,
      chartUpdateStartTime,
      latestQueryFormData,
      queriesResponse,
    } = this.props.chart;
    // TODO: when will get appropriate design for multi queries use all results and not first only
    const queryResponse = queriesResponse?.[0];
    const chartFinished = ['failed', 'rendered', 'success'].includes(
      this.props.chart.chartStatus,
    );
    return (
      <StyledHeader id="slice-header" className="panel-title-large">
        <div className="title-panel">
          <EditableTitle
            title={this.getSliceName()}
            canEdit={!this.props.slice || this.props.can_overwrite}
            onSaveTitle={this.props.actions.updateChartTitle}
          />

          {this.props.slice && (
            <StyledButtons>
              {user.userId && (
                <FaveStar
                  itemId={this.props.slice.slice_id}
                  fetchFaveStar={this.props.actions.fetchFaveStar}
                  saveFaveStar={this.props.actions.saveFaveStar}
                  isStarred={this.props.isStarred}
                  showTooltip
                />
              )}
              <PropertiesModal
                show={this.state.isPropertiesModalOpen}
                onHide={this.closePropertiesModal}
                onSave={this.props.sliceUpdated}
                slice={this.props.slice}
              />
              <Tooltip
                id="edit-desc-tooltip"
                title={t('Edit chart properties')}
              >
                <span
                  role="button"
                  tabIndex={0}
                  className="edit-desc-icon"
                  onClick={this.openPropertiesModal}
                >
                  <i className="fa fa-edit" />
                </span>
              </Tooltip>
              {this.props.chart.sliceFormData && (
                <AlteredSliceTag
                  className="altered"
                  origFormData={this.props.chart.sliceFormData}
                  currentFormData={formData}
                />
              )}
            </StyledButtons>
          )}
        </div>
        <div className="right-button-panel">
          {chartFinished && queryResponse && (
            <RowCountLabel
              rowcount={Number(queryResponse.rowcount) || 0}
              limit={Number(formData.row_limit) || 0}
            />
          )}
          {chartFinished && queryResponse && queryResponse.is_cached && (
            <CachedLabel
              onClick={this.postChartFormData.bind(this)}
              cachedTimestamp={queryResponse.cached_dttm}
            />
          )}
          <Timer
            startTime={chartUpdateStartTime}
            endTime={chartUpdateEndTime}
            isRunning={chartStatus === 'loading'}
            status={CHART_STATUS_MAP[chartStatus]}
          />
          {this.canAddReports() && this.renderReportModal()}
          <ReportModal
            show={this.state.showingReportModal}
            onHide={this.hideReportModal}
            props={{
              userId: this.props.user.userId,
              userEmail: this.props.user.email,
              chartId: this.props.chart.id,
              creationMethod: 'charts',
            }}
          />
          <ExploreActionButtons
            actions={{
              ...this.props.actions,
              openPropertiesModal: this.openPropertiesModal,
            }}
            slice={this.props.slice}
            canDownloadCSV={this.props.can_download}
            chartStatus={chartStatus}
            latestQueryFormData={latestQueryFormData}
            queryResponse={queryResponse}
          />
        </div>
      </StyledHeader>
    );
  }
}

ExploreChartHeader.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    { sliceUpdated, fetchUISpecificReport, toggleActive, deleteActiveReport },
    dispatch,
  );
}

export default connect(null, mapDispatchToProps)(ExploreChartHeader);
