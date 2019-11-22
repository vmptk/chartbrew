import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Link } from "react-router-dom";
import {
  Header, Step, Icon, Form, Dropdown, Input, Button, Popup, Dimmer, Loader,
  Segment, Message, Container, Divider, Sidebar, Grid, List, Modal,
} from "semantic-ui-react";
import {
  Line, Bar, Pie, Doughnut, Radar, Polar
} from "react-chartjs-2";
import moment from "moment";

import "chart.piecelabel.js";

import {
  testQuery, createChart, runQuery, updateChart, getPreviewData
} from "../actions/chart";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import ChartTypesSelector from "../components/ChartTypesSelector";
import ObjectExplorer from "../components/ObjectExplorer";
import ChartBuilder from "../components/ChartBuilder";
import TimeseriesGlobalSettings from "../components/TimeseriesGlobalSettings";
import MongoQueryBuilder from "../components/MongoQueryBuilder";
import ApiBuilder from "../components/ApiBuilder";
import PostgresQueryBuilder from "../components/PostgresQueryBuilder";
import MysqlQueryBuilder from "../components/MysqlQueryBuilder";

/*
  Container used for setting up a new chart
*/
class AddChart extends Component {
  constructor(props) {
    super(props);

    this.state = {
      step: 0,
      newChart: {
        query: "connection.collection('users').find()",
        displayLegend: false,
        Datasets: [{
          xAxis: "root",
          legend: "Dataset #1",
        }],
      },
      ddConnections: [],
      updatedEdit: false, // eslint-disable-line
      initialQuery: "",
      viewDatasetOptions: false,
      activeDataset: 0,
    };
  }

  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
    this._populateConnections();
  }

  componentDidUpdate(prevProps, prevState) {
    const { match } = this.props;

    if (prevProps.charts) {
      if (prevProps.match.params.chartId && prevProps.charts.length > 0 && !prevState.updatedEdit) {
        this._prepopulateState();
      }
    }

    if (prevProps.connections.length > 0 && prevState.ddConnections.length === 0) {
      this._populateConnections();
    }

    if (prevState.canCreate !== 1
      && prevState.canCreate !== 0
      && !match.params.chartId
    ) {
      this._canCreateChart();
    }
  }

  _prepopulateState = () => {
    const { connections, charts, match } = this.props;
    charts.forEach((chart) => {
      if (chart.id === parseInt(match.params.chartId, 10)) {
        const foundChart = chart;
        // objectify the date range if it exists
        if (chart.startDate) {
          foundChart.startDate = moment(chart.startDate);
        }
        if (chart.endDate) {
          foundChart.endDate = moment(chart.endDate);
        }

        // check if the chart has a connection and populate that one as well
        let selectedConnection = null;
        if (foundChart.connection_id) {
          for (let i = 0; i < connections.length; i++) {
            if (connections[i].id === foundChart.connection_id) {
              selectedConnection = connections[i];
              break;
            }
          }
        }

        this.setState({
          newChart: foundChart, updatedEdit: true, initialQuery: chart.query, selectedConnection,
        }, () => {
          this._onPreview();
        });
      }
    });
  }

  _populateConnections = () => {
    const { connections } = this.props;
    const { ddConnections } = this.state;

    if (connections.length < 1) return;
    if (ddConnections.length > 0) return;

    const tempState = ddConnections;
    connections.map((connection) => {
      return tempState.push({
        key: connection.id,
        value: connection.id,
        text: connection.name,
      });
    });

    this.setState({ ddConnections: tempState });
  }

  _onChangeConnection = (value) => {
    const { connections } = this.props;
    const { newChart } = this.state;
    let { query } = newChart;

    let selectedConnection;
    for (let i = 0; i < connections.length; i++) {
      if (connections[i].id === value) {
        selectedConnection = connections[i];
      }
    }

    if (!newChart.id) {
      if (selectedConnection.type === "mongodb") {
        query = "connection.collection('users').find()";
      } else if (selectedConnection.type === "postgres") {
        query = "SELECT * FROM table1;";
      }
    }

    this.setState({
      newChart: { ...newChart, connection_id: value, query },
      selectedConnection,
    });
  }

  _onTypeSelect = (type) => {
    const { newChart } = this.state;
    this.setState({ newChart: { ...newChart, type } });
    return type;
  }

  _onChangeXAxis = (xAxis) => {
    const { activeDataset, newChart } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets[activeDataset].xAxis = xAxis;
    this.setState({ newChart: tempChart });
  }

  _onDatasetColor = (color) => {
    const { activeDataset, newChart, previewChart } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets[activeDataset].datasetColor = color;

    if (previewChart) {
      const tempData = { ...previewChart };
      if (tempData.data.datasets[activeDataset]) {
        tempData.data.datasets[activeDataset].borderColor = color;
      }
      this.setState({
        newChart: tempChart,
        previewChart: tempData,
      });
    } else {
      this.setState({
        newChart: tempChart,
      });
    }
  }

  _onFillColor = (color, colorIndex) => {
    const { activeDataset, newChart, previewChart } = this.state;
    const tempChart = { ...newChart };

    let colorValue = color;
    if (colorIndex != null) {
      colorValue = [color];
      if (!tempChart.Datasets[activeDataset].fillColor) {
        tempChart.Datasets[activeDataset].fillColor = colorValue;
      } else if (tempChart.Datasets[activeDataset].fillColor[colorIndex]) {
        tempChart.Datasets[activeDataset].fillColor[colorIndex] = color;
      } else {
        tempChart.Datasets[activeDataset].fillColor.push(color);
      }

      colorValue = tempChart.Datasets[activeDataset].fillColor;
    }

    tempChart.Datasets[activeDataset].fillColor = colorValue;

    if (previewChart) {
      const tempData = { ...previewChart };
      if (tempData.data.datasets[activeDataset]) {
        if (colorValue) {
          tempData.data.datasets[activeDataset].backgroundColor = colorValue;
          tempData.data.datasets[activeDataset].fill = true;
        } else {
          tempData.data.datasets[activeDataset].fill = false;
        }
      }

      this.setState({
        newChart: tempChart,
        previewChart: tempData,
      });
    } else {
      this.setState({
        newChart: tempChart,
      });
    }
  }

  _onChangeLegend = (legend) => {
    const { activeDataset, newChart, previewChart } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets[activeDataset].legend = legend;

    if (previewChart) {
      const tempData = { ...previewChart };
      if (tempData.data.datasets[activeDataset]) {
        if (legend) {
          tempData.data.datasets[activeDataset].label = legend;
        } else {
          tempData.data.datasets[activeDataset].label = "";
        }
      }
      this.setState({ newChart: tempChart, previewChart: tempData });
    } else {
      this.setState({ newChart: tempChart });
    }
  }

  _onChangePoint = (point) => {
    const { newChart, previewChart } = this.state;
    if (previewChart) {
      const tempData = { ...previewChart };
      tempData.options.elements.point.radius = point;
      tempData.data.datasets[0].pointRadius = point;
      this.setState({
        newChart: { ...newChart, pointRadius: point },
        previewChart: tempData,
      });
    } else {
      this.setState({ newChart: { ...newChart, pointRadius: point } });
    }
  }

  _onDisplayLegend = (display) => {
    const { newChart, previewChart, pointRadius } = this.state;

    if (previewChart) {
      const tempData = { ...previewChart };
      tempData.options.legend.display = display;
      tempData.options.elements.point.radius = pointRadius;
      tempData.data.datasets[0].pointRadius = pointRadius;
      this.setState({
        newChart: { ...newChart, displayLegend: display },
        previewChart: tempData,
      }, () => {
        // tempData.options.elements.point.radius = this.state.pointRadius;
        // tempData.data.datasets[0].pointRadius = this.state.pointRadius;
        // this.setState({ previewChart: tempData });
      });
    } else {
      this.setState({
        newChart: { ...newChart, displayLegend: display },
      });
    }
  }

  _onChangePatterns = (patterns) => {
    const { activeDataset, newChart } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets[activeDataset].patterns = JSON.parse(JSON.stringify(patterns));

    this.setState({ newChart: tempChart });
  }

  _onDateRange = (range) => {
    const { newChart } = this.state;
    this.setState({
      newChart: {
        ...newChart,
        startDate: range.startDate,
        endDate: range.endDate,
      }
    });
  }

  _formatApiRequest = () => {
    const { apiRequest } = this.state;
    if (!apiRequest) return {};

    const { formattedHeaders } = apiRequest;

    let newHeaders = {};
    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].key && formattedHeaders[i].value) {
        newHeaders = { [formattedHeaders[i].key]: formattedHeaders[i].value, ...newHeaders };
      }
    }

    const newRequest = apiRequest;
    newRequest.headers = newHeaders;

    return newRequest;
  }

  _onPreview = () => {
    const { getPreviewData, match } = this.props;
    const { newChart, selectedConnection } = this.state;
    const previewData = newChart;

    if (selectedConnection && selectedConnection.type === "api") {
      previewData.apiRequest = this._formatApiRequest();
    }

    this.setState({ previewLoading: true, previewError: false });
    getPreviewData(match.params.projectId, previewData)
      .then((chartData) => {
        this.setState({ previewChart: chartData, previewLoading: false });
      })
      .catch(() => {
        this.setState({ previewLoading: false, previewError: true });
      });
  }

  _testQuery = () => {
    const { testQuery, match } = this.props;
    const { newChart } = this.state;
    this.setState({
      testError: false, testingQuery: true, testSuccess: false, testFailed: false,
    });
    return testQuery(match.params.projectId, newChart)
      .then((data) => {
        this.setState({
          testingQuery: false,
          testSuccess: true,
          queryData: data,
          initialQuery: newChart.query
        });
      })
      .catch((error) => {
        if (error === 413) {
          this.setState({ testingQuery: false, testError: true });
        } else {
          this.setState({ testingQuery: false, testFailed: true, testError: true });
        }
      });
  }

  _apiTest = (data) => {
    this.setState({ testSuccess: true, queryData: data });
  }

  _validate = () => {
    const { newChart } = this.state;
    // Line chart with timeseries
    if ((newChart.type === "line" || newChart.type === "bar")
      && (newChart.subType === "lcTimeseries" || newChart.subType === "lcAddTimeseries"
      || newChart.subType === "bcTimeseries" || newChart.subType === "bcAddTimeseries")) {
      // check if the xAxis is properly formatted (the date is inside an array)
      if (newChart.xAxis.indexOf("[]") === -1 || (newChart.xAxis.match(/[]/g) || []).length > 1) { // eslint-disable-line
        this.setState({ lcArrayError: true });
        return false;
      }
    }

    return true;
  }

  _onAddNewDataset = () => {
    const { newChart } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets.push({
      xAxis: "root",
      legend: `Dataset #${tempChart.Datasets.length + 1}`,
    });
    this.setState({
      newChart: tempChart,
      activeDataset: tempChart.Datasets.length - 1,
      viewDatasetOptions: true
    });
  }

  _onRemoveDataset = (remove) => {
    const { newChart, activeDataset } = this.state;
    const tempChart = { ...newChart };
    tempChart.Datasets[activeDataset].deleted = remove;
    this.setState({ newChart: tempChart });
    this._onPreview();
  }

  _onUpdateConfirmation = () => {
    const { newChart } = this.state;
    let showModal = false;
    for (const dataset of newChart.Datasets) { // eslint-disable-line
      if (dataset.deleted) {
        showModal = true;
        break;
      }
    }

    if (showModal) {
      this.setState({ removeModal: true });
    } else {
      this._onCreateChart();
    }
  }

  _onCreateChart = () => {
    const {
      createChart, match, runQuery, history, updateChart
    } = this.props;
    const { newChart, selectedConnection } = this.state;
    const updatedChart = newChart;

    if (selectedConnection.type === "api") {
      updatedChart.apiRequest = this._formatApiRequest();
    }

    this.setState({ createLoading: true, removeModal: false });

    if (!newChart.id) {
      createChart(match.params.projectId, updatedChart)
        .then((chart) => {
          return runQuery(match.params.projectId, chart.id);
        })
        .then(() => {
          this.setState({ createLoading: false });
          history.push(`/${match.params.teamId}/${match.params.projectId}/dashboard`);
        })
        .catch(() => {
          this.setState({ createLoading: false, createError: true });
        });
    } else {
      updateChart(
        match.params.projectId,
        newChart.id,
        updatedChart
      )
        .then((chart) => {
          return runQuery(match.params.projectId, chart.id);
        })
        .then(() => {
          this.setState({ createLoading: false });
          history.push(`/${match.params.teamId}/${match.params.projectId}/dashboard`);
        })
        .catch(() => {
          this.setState({ createLoading: false, createError: true });
        });
    }
  }

  _canCreateChart = () => {
    const { team, charts } = this.props;
    const { newChart } = this.state;

    if (team.plan && team.plan.charts <= charts.length && !newChart.id) {
      this.setState({ canCreate: 0, limitationModal: true });
    } else if (team.plan) {
      this.setState({ canCreate: 1 });
    }
  }

  limitationModal = () => {
    const { match, errors, cleanErrors } = this.props;

    let dataLimit = false;
    errors.map((error) => {
      if (error.code === 413 && error.pathname === window.location.pathname) {
        dataLimit = true;
      }
      return error;
    });

    return (
      <Modal open={dataLimit} size="small" onClose={() => cleanErrors()}>
        <Header
          content="Oh no! You've reached the limits of your plan."
          inverted
        />
        <Modal.Content>
          {"The payload of your request is too large. You can limit the amount of data you're requesting from the API or upgrade your plan."}
        </Modal.Content>
        <Modal.Actions>
          <Button
            onClick={() => cleanErrors()}
          >
            Close
          </Button>
          <Link to={`/manage/${match.params.teamId}/plans`}>
            <Button
              positive
            >
              See the plans
            </Button>
          </Link>
        </Modal.Actions>
      </Modal>
    );
  }

  render() {
    const {
      activeDataset, newChart, previewChart, selectedConnection, testSuccess,
      viewDatasetOptions, queryData, step, ddConnections,
      testError, testFailed, testingQuery, apiRequest, previewLoading,
      previewError, lcArrayError, createError, initialQuery,
      removeModal, createLoading, removeLoading, limitationModal, canCreate
    } = this.state;
    const { connections, match } = this.props;

    if (limitationModal) {
      return (
        <Segment style={styles.mainSegment}>
          <Dimmer active={canCreate === 0} inverted>
            <Header as="h2" icon style={{ color: "black" }}>
              <Icon name="lock" />
              You reached the limits of your plan
              <Header.Subheader>
                Unlock more charts below
              </Header.Subheader>
            </Header>
            <div>
              <Link to={`/manage/${match.params.teamId}/plans`}>
                <Button
                  size="large"
                  primary
                  icon
                  labelPosition="right"
                >
                  <Icon name="chevron right" />
                  See available plans
                </Button>
              </Link>
            </div>
          </Dimmer>
        </Segment>
      );
    }

    return (
      <div style={styles.container}>
        <Sidebar.Pushable as={Segment}>
          <Sidebar
            as={Segment}
            color="teal"
            animation="overlay"
            visible={viewDatasetOptions}
            width="very wide"
            direction="right"
            style={{ width: "50%" }}
          >
            <Container textAlign="center">
              <Button.Group widths="3">
                <Button
                  icon
                  labelPosition="left"
                  onClick={this._onPreview}
                >
                  <Icon name="refresh" />
                  Preview
                </Button>
                <Button
                  secondary
                  onClick={() => {
                    this.setState({ viewDatasetOptions: false });
                    this._onPreview();
                  }}
                >
                  Done
                </Button>
                {!newChart.Datasets[activeDataset].deleted
                  && (
                  <Button
                    basic
                    negative
                    icon
                    labelPosition="right"
                    onClick={() => this._onRemoveDataset(true)}
                  >
                    <Icon name="x" />
                    Remove
                  </Button>
                  )}
                {newChart.Datasets[activeDataset].deleted
                  && (
                  <Button
                    basic
                    icon
                    labelPosition="right"
                    onClick={() => this._onRemoveDataset(false)}
                  >
                    <Icon name="plus" />
                    Re-enable
                  </Button>
                  )}
              </Button.Group>
            </Container>
            <Divider />
            <Container text>
              <Popup
                trigger={(
                  <Button icon labelPosition="left">
                    <Icon name="info" />
                    How to select fields
                  </Button>
)}
              >
                <Container text>
                  <Header>Selecting fields</Header>
                  <p>{"You can use the object visualizer below. Just click on it to expand your data tree."}</p>
                  <p>{"You can manually select a field just as you would access an attribute within an object in Javascript:"}</p>
                  <pre>root.someOtherObject.value</pre>
                  <p>{"Array fields are identified by appending '[]' at the end like so"}</p>
                  <pre>root.someArrayField[].value</pre>
                </Container>
              </Popup>
            </Container>
            <br />
            {queryData
              && (
              <ObjectExplorer
                objectData={queryData}
                type={newChart.type}
                subType={newChart.subType}
                onSelectXField={(value) => this._onChangeXAxis(value)}
                onSelectYField={(value) => {
                  this.setState({ newChart: { ...newChart, yAxis: value } });
                }}
              />
              )}
            <br />
            {activeDataset !== false
              && (
              <ChartBuilder
                type={newChart.type}
                subType={newChart.subType}
                editChart={!!newChart.id}
                xAxis={newChart.Datasets[activeDataset].xAxis || ""}
                datasetColor={newChart.Datasets[activeDataset].datasetColor}
                fillColor={newChart.Datasets[activeDataset].fillColor}
                legend={newChart.Datasets[activeDataset].legend}
                patterns={newChart.Datasets[activeDataset].patterns}
                dataArray={previewChart && previewChart.data.datasets[activeDataset]
                  ? previewChart.data.datasets[activeDataset].data
                  : newChart.chartData && newChart.chartData.data.datasets[activeDataset]
                    ? newChart.chartData.data.datasets[activeDataset].data : []}
                dataLabels={previewChart
                  ? previewChart.data.labels : newChart.chartData
                    ? newChart.chartData.data.labels : []}
                onChangeXAxis={(xAxis) => this._onChangeXAxis(xAxis)}
                onDatasetColor={(color) => this._onDatasetColor(color)}
                onFillColor={(color, colorIndex) => this._onFillColor(color, colorIndex)}
                onChangeLegend={(legend) => this._onChangeLegend(legend)}
                onChangePatterns={(patterns) => this._onChangePatterns(patterns)}
              />
              )}
          </Sidebar>
          <Sidebar.Pusher>
            <Container
              fluid
              style={{
                paddingLeft: 20,
                paddingRight: viewDatasetOptions ? 0 : 10,
              }}
              onClick={() => {
                if (viewDatasetOptions) {
                  this.setState({ viewDatasetOptions: false });
                }
              }}
            >
              <Segment attached style={styles.mainSegment}>
                <Step.Group fluid widths={4}>
                  <Step
                    active={step === 0}
                    onClick={() => this.setState({ step: 0 })}
                  >
                    <Icon name="th large" />
                    <Step.Content>
                      <Step.Title>Chart type</Step.Title>
                      <Step.Description>Choose your chart type</Step.Description>
                    </Step.Content>
                  </Step>

                  <Step
                    active={step === 1}
                    disabled={!newChart.subType}
                    onClick={() => this.setState({ step: 1 })}
                  >
                    <Icon name="plug" />
                    <Step.Content>
                      <Step.Title>Connect</Step.Title>
                      <Step.Description>Your database connection</Step.Description>
                    </Step.Content>
                  </Step>

                  <Step
                    active={step === 2}
                    disabled={
                      !newChart.connection_id
                      || !newChart.name
                      || !newChart.subType
                    }
                    onClick={() => this.setState({ step: 2 })}
                  >
                    <Icon name="database" />
                    <Step.Content>
                      <Step.Title>Query</Step.Title>
                      <Step.Description>Get some data</Step.Description>
                    </Step.Content>
                  </Step>

                  <Step
                    active={step === 3}
                    disabled={
                      !newChart.connection_id
                      || !newChart.name
                      || !testSuccess
                      || !newChart.subType
                    }
                    onClick={() => this.setState({ step: 3 })}
                  >
                    <Icon name="chart area" />
                    <Step.Content>
                      <Step.Title>Build</Step.Title>
                      <Step.Description>Build your chart</Step.Description>
                    </Step.Content>
                  </Step>
                </Step.Group>

                {step === 0
                  && (
                  <ChartTypesSelector
                    type={newChart.type}
                    subType={newChart.subType}
                    typeSelected={(type) => {
                      setTimeout(() => this.setState({ newChart: { ...newChart, type } }));
                    }}
                    subTypeSelected={(subType) => {
                      if (!subType) {
                        setTimeout(() => {
                          // hacky things
                          this.setState({ newChart: { ...newChart, subType: "" } });
                        });
                      } else {
                        this.setState({ newChart: { ...newChart, subType } });
                      }
                    }}
                  />
                  )}

                {step === 1
                  && (
                  <Form>
                    <Form.Field>
                      <label>What will your chart show?</label>
                      <Input
                        placeholder="Give your chart a short description"
                        value={newChart.name || ""}
                        onChange={(e, data) => {
                          this.setState({ newChart: { ...newChart, name: data.value } });
                        }}
                      />
                    </Form.Field>

                    <Form.Field>
                      <label>Select a connection</label>
                      <Dropdown
                        placeholder="Select an available connection from the list"
                        selection
                        value={newChart.connection_id}
                        options={ddConnections}
                        disabled={connections.length < 1}
                        onChange={(e, data) => this._onChangeConnection(data.value)}
                      />
                    </Form.Field>
                    {connections.length < 1
                      && (
                      <Form.Field>
                        <Link to={`/${match.params.teamId}/${match.params.projectId}/connections`}>
                          <Button primary icon labelPosition="right">
                            <Icon name="plug" />
                              Go to connections
                          </Button>
                        </Link>
                      </Form.Field>
                      )}
                  </Form>
                  )}

                {step === 2 && selectedConnection.type === "mongodb"
                  && (
                  <MongoQueryBuilder
                    currentQuery={newChart.query}
                    onChangeQuery={(value) => {
                      this.setState({ newChart: { ...newChart, query: value } });
                    }}
                    testQuery={this._testQuery}
                    testSuccess={testSuccess}
                    testError={testError}
                    testFailed={testFailed}
                    testingQuery={testingQuery}
                  />
                  )}

                {step === 2 && selectedConnection.type === "api"
                  && (
                  <ApiBuilder
                    connection={selectedConnection}
                    onComplete={(data) => this._apiTest(data)}
                    apiRequest={apiRequest || ""}
                    onChangeRequest={(apiRequest) => {
                      this.setState({ apiRequest });
                    }}
                    chartId={newChart.id}
                  />
                  )}

                {step === 2 && selectedConnection.type === "postgres"
                  && (
                  <PostgresQueryBuilder
                    currentQuery={newChart.query}
                    onChangeQuery={(value) => {
                      this.setState({ newChart: { ...newChart, query: value } });
                    }}
                    testQuery={this._testQuery}
                    testSuccess={testSuccess}
                    testError={testError}
                    testFailed={testFailed}
                    testingQuery={testingQuery}
                  />
                  )}

                {step === 2 && selectedConnection.type === "mysql"
                  && (
                  <MysqlQueryBuilder
                    currentQuery={newChart.query}
                    onChangeQuery={(value) => {
                      this.setState({ newChart: { ...newChart, query: value } });
                    }}
                    testQuery={this._testQuery}
                    testSuccess={testSuccess}
                    testError={testError}
                    testFailed={testFailed}
                    testingQuery={testingQuery}
                  />
                  )}

                {step === 3
                  && (
                  <Grid columns={2} centered divided>
                    <Grid.Column width={8}>
                      <Dimmer inverted active={previewLoading}>
                        <Loader inverted />
                      </Dimmer>
                      <Container textAlign="center">
                        <Header textAlign="left" as="h3" dividing>
                          Build your chart
                        </Header>
                        <Button
                          icon
                          labelPosition="left"
                          onClick={this._onPreview}
                          style={{ marginBottom: 20 }}
                        >
                          <Icon name="refresh" />
                          Refresh Preview
                        </Button>
                      </Container>
                      {previewChart
                        && (
                        <div style={{ maxHeight: "30em" }}>
                          {newChart.type === "line"
                            && (
                            <Line
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "bar"
                            && (
                            <Bar
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "pie"
                            && (
                            <Pie
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "doughnut"
                            && (
                            <Doughnut
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "radar"
                            && (
                            <Radar
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                          {newChart.type === "polar"
                            && (
                            <Polar
                              data={previewChart.data}
                              options={previewChart.options}
                              height={300}
                            />
                            )}
                        </div>
                        )}
                      {!previewChart
                        && <p>{"No data to preview. Configure your datasets and press the refresh button."}</p>}
                      {previewError
                        && (
                        <div>
                          <br />
                          <Message negative>
                            <Message.Header>
                              {"Oh snap! We could't render the chart for you"}
                            </Message.Header>
                            <p>{"Make sure your configuration, like the query and selected fields are valid."}</p>
                          </Message>
                        </div>
                        )}
                    </Grid.Column>
                    <Grid.Column width={8}>
                      <Header as="h3" dividing>
                        Configure your datasets
                      </Header>

                      <Header size="small">Datasets</Header>
                      {newChart.Datasets.map((dataset, index) => {
                        if (dataset.deleted) {
                          return (
                            <Button
                              key={dataset.legend}
                              basic
                              primary
                              icon
                              labelPosition="right"
                              onClick={() => {
                                this.setState({ viewDatasetOptions: true, activeDataset: index });
                              }}
                            >
                              <Icon name="x" />
                              {dataset.legend || "Dataset"}
                            </Button>
                          );
                        }
                        return (
                          <Button
                            key={dataset.legend}
                            primary
                            icon
                            labelPosition="right"
                            onClick={() => {
                              this.setState({ viewDatasetOptions: true, activeDataset: index });
                            }}
                          >
                            <Icon name="options" />
                            {dataset.legend || "Dataset"}
                          </Button>
                        );
                      })}
                      <br />

                      {newChart.type !== "polar"
                        && (
                        <List animated verticalAlign="middle">
                          <List.Item as="a" onClick={this._onAddNewDataset}>
                            <Icon name="plus" />
                            <List.Content>
                              <List.Header>
                                Add a new dataset
                              </List.Header>
                            </List.Content>
                          </List.Item>
                        </List>
                        )}
                      <Divider />

                      <Header size="small">
                        Global settings
                      </Header>
                      <TimeseriesGlobalSettings
                        type={newChart.type}
                        subType={newChart.subType}
                        pointRadius={newChart.pointRadius}
                        startDate={newChart.startDate}
                        endDate={newChart.endDate}
                        displayLegend={newChart.displayLegend}
                        includeZeros={newChart.includeZeros}
                        currentEndDate={newChart.currentEndDate}
                        timeInterval={newChart.timeInterval}
                        onDisplayLegend={() => this._onDisplayLegend(!newChart.displayLegend)}
                        onChangeDateRange={this._onDateRange}
                        onChangePoint={(point) => this._onChangePoint(point)}
                        onChangeZeros={(includeZeros) => {
                          this.setState({ newChart: { ...newChart, includeZeros } }, () => {
                            this._onPreview();
                          });
                        }}
                        onChangeCurrentEndDate={(currentEndDate) => {
                          this.setState({ newChart: { ...newChart, currentEndDate } }, () => {
                            this._onPreview();
                          });
                        }}
                        onChangeTimeInterval={(timeInterval) => {
                          this.setState({ newChart: { ...newChart, timeInterval } }, () => {
                            this._onPreview();
                          });
                        }}
                        onComplete={() => this._onPreview()}
                      />
                    </Grid.Column>
                  </Grid>
                  )}
                {createError
                  && (
                  <Message
                    negative
                    onDismiss={() => this.setState({ createError: false })}
                    header="There was a problem with your request"
                    content="This is on us, we couldn't process your request. Please try again."
                  />
                  )}
                {lcArrayError
                  && (
                  <Message
                    negative
                    onDismiss={() => this.setState({ lcArrayError: false })}
                    header="The data you selected is not correct"
                    content="In order to create a valid time series chart, you must select a date field that is within an array. Make sure there is only one array in your selector '[]'."
                  />
                  )}
              </Segment>
              <Button.Group attached="bottom">
                <Button
                  color="teal"
                  icon
                  labelPosition="left"
                  disabled={step === 0}
                  onClick={() => this.setState({ step: step - 1 })}
                >
                  <Icon name="chevron left" />
                  Back
                </Button>

                {newChart.id
                  && (
                  <Button
                    primary
                    disabled={
                      initialQuery !== newChart.query || !newChart.subType
                    }
                    loading={createLoading}
                    onClick={this._onUpdateConfirmation}
                  >
                    Update the chart
                  </Button>
                  )}

                {step < 3
                  && (
                  <Button
                    secondary
                    icon
                    labelPosition="right"
                    onClick={() => {
                      if (step === 2 && !testSuccess && selectedConnection.type !== "api") {
                        this._testQuery();
                      } else {
                        this.setState({ step: step + 1 });
                      }
                    }}
                    loading={testingQuery}
                    disabled={
                      (step === 0 && !newChart.subType)
                      || (step === 1 && (!newChart.connection_id || !newChart.name))
                    }
                  >
                    <Icon name="chevron right" />
                    {(step === 2 && !testSuccess && selectedConnection.type !== "api")
                      ? "Run test" : "Next"}
                  </Button>
                  )}
                {step > 2 && !newChart.id
                  && (
                  <Button
                    secondary
                    icon
                    labelPosition="right"
                    disabled={!testSuccess}
                    loading={createLoading}
                    onClick={this._onCreateChart}
                  >
                    <Icon name="checkmark" />
                    Create the chart
                  </Button>
                  )}
              </Button.Group>
            </Container>
          </Sidebar.Pusher>
        </Sidebar.Pushable>

        <Modal
          open={removeModal}
          basic
          size="small"
          onClose={() => this.setState({ removeModal: false })}
        >
          <Header
            icon="exclamation triangle"
            content="All the datasets that were market as deleted will be forever removed upon updating"
          />
          <Modal.Content>
            <p>
              {"You can always re-enable datasets while editing the chart, but once you save the changes all the datasets marked as deleted will be gone forever."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => this.setState({ removeModal: false })}
            >
              Go back
            </Button>
            <Button
              color="teal"
              inverted
              loading={!!removeLoading}
              onClick={this._onCreateChart}
            >
              <Icon name="checkmark" />
              Update & Remove datasets
            </Button>
          </Modal.Actions>
        </Modal>

        {this.limitationModal()}
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
  mainContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  mainSegment: {
    minHeight: 600,
  },
};

AddChart.propTypes = {
  connections: PropTypes.array.isRequired,
  testQuery: PropTypes.func.isRequired,
  createChart: PropTypes.func.isRequired,
  updateChart: PropTypes.func.isRequired,
  runQuery: PropTypes.func.isRequired,
  getPreviewData: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  charts: PropTypes.array.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  errors: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    charts: state.chart.data,
    team: state.team.active,
    errors: state.error,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    testQuery: (projectId, data) => dispatch(testQuery(projectId, data)),
    createChart: (projectId, data) => dispatch(createChart(projectId, data)),
    runQuery: (projectId, chartId) => dispatch(runQuery(projectId, chartId)),
    updateChart: (projectId, chartId, data) => dispatch(updateChart(projectId, chartId, data)),
    getPreviewData: (projectId, chart) => dispatch(getPreviewData(projectId, chart)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AddChart));
