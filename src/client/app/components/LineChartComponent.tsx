/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as _ from 'lodash';
import * as moment from 'moment';
import { PlotRelayoutEvent } from 'plotly.js';
import * as React from 'react';
import Plot, { Figure } from 'react-plotly.js';
import { TimeInterval } from '../../../common/TimeInterval';
import { graphSlice, selectSelectedGroups, selectSelectedMeters } from '../reducers/graph';
import { groupsSlice } from '../reducers/groups';
import { metersSlice } from '../reducers/meters';
import { unitsSlice } from '../reducers/units';
import { readingsApi } from '../redux/api/readingsApi';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { ChartQueryProps, LineReadingApiArgs } from '../redux/selectors/dataSelectors';
import { DataType } from '../types/Datasources';
import { AreaUnitType, getAreaUnitConversion } from '../utils/getAreaUnitConversion';
import getGraphColor from '../utils/getGraphColor';
import { lineUnitLabel } from '../utils/graphics';
import translate from '../utils/translate';
import LogoSpinner from './LogoSpinner';


/**
 * @param props qpi query
 * @returns plotlyLine graphic
 */
export default function LineChartComponent(props: ChartQueryProps<LineReadingApiArgs>) {
	const { meterArgs, groupsArgs, meterSkipQuery, groupSkipQuery } = props.queryProps;
	const dispatch = useAppDispatch();

	const selectedUnit = useAppSelector(state => state.graph.selectedUnit);
	// The unit label depends on the unit which is in selectUnit state.
	const graphingUnit = useAppSelector(state => state.graph.selectedUnit);
	// The current selected rate
	const currentSelectedRate = useAppSelector(state => state.graph.lineGraphRate);
	const unitDataByID = useAppSelector(state => unitsSlice.selectors.selectUnitDataById(state));
	const selectedAreaNormalization = useAppSelector(state => state.graph.areaNormalization);
	const selectedAreaUnit = useAppSelector(state => state.graph.selectedAreaUnit);
	const selectedMeters = useAppSelector(state => selectSelectedMeters(state));
	const selectedGroups = useAppSelector(state => selectSelectedGroups(state));
	const metersState = useAppSelector(state => metersSlice.selectors.selectMeterState(state));
	const meterDataByID = useAppSelector(state => metersSlice.selectors.selectMeterDataByID(state));
	const groupDataByID = useAppSelector(state => groupsSlice.selectors.selectGroupDataByID(state));

	// dataFetching Query Hooks
	const { data: meterReadings, isLoading: meterIsFetching } = readingsApi.useLineQuery(meterArgs, { skip: meterSkipQuery });
	const { data: groupData, isLoading: groupIsFetching } = readingsApi.useLineQuery(groupsArgs, { skip: groupSkipQuery });

	const datasets = [];

	if (meterIsFetching || groupIsFetching) {
		return <LogoSpinner />
		// return <SpinnerComponent loading width={50} height={50} />
	}

	// The unit label depends on the unit which is in selectUnit state.
	// The current selected rate
	let unitLabel = '';
	let needsRateScaling = false;
	// variables to determine the slider min and max
	let minTimestamp: number | undefined;
	let maxTimestamp: number | undefined;
	// If graphingUnit is -99 then none selected and nothing to graph so label is empty.
	// This will probably happen when the page is first loaded.
	if (graphingUnit !== -99) {
		const selectUnitState = unitDataByID[selectedUnit];
		if (selectUnitState !== undefined) {
			// Determine the y-axis label and if the rate needs to be scaled.
			const returned = lineUnitLabel(selectUnitState, currentSelectedRate, selectedAreaNormalization, selectedAreaUnit);
			unitLabel = returned.unitLabel
			needsRateScaling = returned.needsRateScaling;
		}
	}
	// The rate will be 1 if it is per hour (since state readings are per hour) or no rate scaling so no change.
	const rateScaling = needsRateScaling ? currentSelectedRate.rate : 1;
	// Add all valid data from existing meters to the line plot
	for (const meterID of selectedMeters) {
		const byMeterID = meterReadings
		// Make sure have the meter data. If you already have the meter, unselect, change
		// the timeInterval via another meter and then reselect then this new timeInterval
		// may not yet be in state so verify with the second condition on the if.
		// Note the second part may not be used based on next checks but do here since simple.
		if (byMeterID) {
			const meterArea = metersState.byMeterID[meterID].area;
			// We either don't care about area, or we do in which case there needs to be a nonzero area.
			if (!selectedAreaNormalization || (meterArea > 0 && meterDataByID[meterID].areaUnit != AreaUnitType.none)) {
				// Convert the meter area into the proper unit if normalizing by area or use 1 if not so won't change reading values.
				const areaScaling = selectedAreaNormalization ? meterArea * getAreaUnitConversion(meterDataByID[meterID].areaUnit, selectedAreaUnit) : 1;
				// Divide areaScaling into the rate so have complete scaling factor for readings.
				const scaling = rateScaling / areaScaling;
				const readingsData = meterReadings[meterID]
				if (readingsData !== undefined && !meterIsFetching) {
					const label = meterDataByID[meterID].identifier;
					const colorID = meterID;
					if (readingsData === undefined) {
						throw new Error('Unacceptable condition: readingsData.readings is undefined.');
					}

					// Create two arrays for the x and y values. Fill the array with the data from the line readings
					const xData: string[] = [];
					const yData: number[] = [];
					const hoverText: string[] = [];
					const readings = _.values(readingsData);
					readings.forEach(reading => {
						// As usual, we want to interpret the readings in UTC. We lose the timezone as this as the start/endTimestamp
						// are equivalent to Unix timestamp in milliseconds.
						const st = moment.utc(reading.startTimestamp);
						// Time reading is in the middle of the start and end timestamp
						const timeReading = st.add(moment.utc(reading.endTimestamp).diff(st) / 2);
						xData.push(timeReading.format('YYYY-MM-DD HH:mm:ss'));
						const readingValue = reading.reading * scaling;
						yData.push(readingValue);
						hoverText.push(`<b> ${timeReading.format('ddd, ll LTS')} </b> <br> ${label}: ${readingValue.toPrecision(6)} ${unitLabel}`);
					});

					/*
					get the min and max timestamp of the meter, and compare it to the global values
					TODO: If we know the interval and frequency of meter data, these calculations should be able to be simplified
					*/
					if (readings.length > 0) {
						if (minTimestamp == undefined || readings[0]['startTimestamp'] < minTimestamp) {
							minTimestamp = readings[0]['startTimestamp'];
						}
						if (maxTimestamp == undefined || readings[readings.length - 1]['endTimestamp'] >= maxTimestamp) {
							// Need to add one extra reading interval to avoid range truncation. The max bound seems to be treated as non-inclusive
							maxTimestamp = readings[readings.length - 1]['endTimestamp'] + (readings[0]['endTimestamp'] - readings[0]['startTimestamp']);
						}
					}

					// This variable contains all the elements (x and y values, line type, etc.) assigned to the data parameter of the Plotly object
					datasets.push({
						name: label,
						x: xData,
						y: yData,
						text: hoverText,
						hoverinfo: 'text',
						type: 'scatter',
						mode: 'lines',
						line: {
							shape: 'spline',
							width: 2,
							color: getGraphColor(colorID, DataType.Meter)
						}
					});
				}
			}
		}
	}

	// TODO The meters and groups code is very similar and maybe it should be refactored out to create a function to do
	// both. This would mean future changes would automatically happen to both.
	// Add all valid data from existing groups to the line plot
	for (const groupID of selectedGroups) {
		const byGroupID = groupData
		// Make sure have the group data. If you already have the group, unselect, change
		// the timeInterval via another meter and then reselect then this new timeInterval
		// may not yet be in state so verify with the second condition on the if.
		// Note the second part may not be used based on next checks but do here since simple.
		if (byGroupID) {
			const groupArea = groupDataByID[groupID].area;
			// We either don't care about area, or we do in which case there needs to be a nonzero area.
			if (!selectedAreaNormalization || (groupArea > 0 && groupDataByID[groupID].areaUnit != AreaUnitType.none)) {
				// Convert the group area into the proper unit if normalizing by area or use 1 if not so won't change reading values.
				const areaScaling = selectedAreaNormalization ?
					groupArea * getAreaUnitConversion(groupDataByID[groupID].areaUnit, selectedAreaUnit) : 1;
				// Divide areaScaling into the rate so have complete scaling factor for readings.
				const scaling = rateScaling / areaScaling;
				const readingsData = byGroupID[groupID];
				if (readingsData !== undefined && !groupIsFetching) {
					const label = groupDataByID[groupID].name;
					const colorID = groupID;
					if (readingsData === undefined) {
						throw new Error('Unacceptable condition: readingsData.readings is undefined.');
					}

					// Create two arrays for the x and y values. Fill the array with the data from the line readings
					const xData: string[] = [];
					const yData: number[] = [];
					const hoverText: string[] = [];
					const readings = _.values(readingsData);
					readings.forEach(reading => {
						// As usual, we want to interpret the readings in UTC. We lose the timezone as this as the start/endTimestamp
						// are equivalent to Unix timestamp in milliseconds.
						const st = moment.utc(reading.startTimestamp);
						// Time reading is in the middle of the start and end timestamp
						const timeReading = st.add(moment.utc(reading.endTimestamp).diff(st) / 2);
						xData.push(timeReading.utc().format('YYYY-MM-DD HH:mm:ss'));
						const readingValue = reading.reading * scaling;
						yData.push(readingValue);
						hoverText.push(`<b> ${timeReading.format('ddd, ll LTS')} </b> <br> ${label}: ${readingValue.toPrecision(6)} ${unitLabel}`);
					});

					// get the min and max timestamp of the group, and compare it to the global values
					if (readings.length > 0) {
						if (minTimestamp == undefined || readings[0]['startTimestamp'] < minTimestamp) {
							minTimestamp = readings[0]['startTimestamp'];
						}
						if (maxTimestamp == undefined || readings[readings.length - 1]['endTimestamp'] >= maxTimestamp) {
							// Need to add one extra reading interval to avoid range truncation. The max bound seems to be treated as non-inclusive
							maxTimestamp = readings[readings.length - 1]['endTimestamp'] + (readings[0]['endTimestamp'] - readings[0]['startTimestamp']);
						}
					}

					// This variable contains all the elements (x and y values, line type, etc.) assigned to the data parameter of the Plotly object
					datasets.push({
						name: label,
						x: xData,
						y: yData,
						text: hoverText,
						hoverinfo: 'text',
						type: 'scatter',
						mode: 'lines',
						line: {
							shape: 'spline',
							width: 2,
							color: getGraphColor(colorID, DataType.Group)
						}
					});
				}
			}
		}
	}

	// Method responsible for setting the 'Working Time Interval'
	const handleOnInit = (figure: Figure) => {
		if (figure.layout.xaxis?.range) {
			const startTS = moment.utc(figure.layout.xaxis?.range[0])
			const endTS = moment.utc(figure.layout.xaxis?.range[1])
			const workingTimeInterval = new TimeInterval(startTS, endTS);
			dispatch(graphSlice.actions.updateWorkingTimeInterval(workingTimeInterval))
		}
	}

	const handleRelayout = (e: PlotRelayoutEvent) => {
		// This event emits an object that contains values indicating changes in the user's graph, such as zooming.
		// These values indicate when the user has zoomed or made other changes to the graph.
		if (e['xaxis.range[0]'] && e['xaxis.range[0]']) {
			// The event signals changes in the user's interaction with the graph.
			// this will automatically trigger a refetch due to updating a query arg.
			const startTS = moment.utc(e['xaxis.range[0]'])
			const endTS = moment.utc(e['xaxis.range[1]'])
			const workingTimeInterval = new TimeInterval(startTS, endTS);
			dispatch(graphSlice.actions.updateTimeInterval(workingTimeInterval));
			dispatch(graphSlice.actions.updateWorkingTimeInterval(workingTimeInterval))

		}
	}

	let enoughData = false;
	datasets.forEach(dataset => {
		if (dataset.x.length > 1) {
			enoughData = true
			return
		}
	})
	// console.log(datasets.length, datasets)
	// Customize the layout of the plot
	// See https://community.plotly.com/t/replacing-an-empty-graph-with-a-message/31497 for showing text not plot.
	if (datasets.length === 0) {
		return <h1>
			{`${translate('select.meter.group')}`}
		</h1>
	} else if (!enoughData) {
		// This normal so plot.
		return <h1>
			{`${translate('threeD.no.data')}`}
		</h1>
	} else {
		return (
			<div style={{ width: '100%', height: '100%' }}>
				<Plot
					data={datasets as Plotly.Data[]}
					onInitialized={handleOnInit}
					onRelayout={handleRelayout}
					style={{ width: '100%', height: '80%' }}
					useResizeHandler={true}
					config={{
						responsive: true
					}}
					layout={{
						autosize: true, showlegend: true,
						legend: { x: 0, y: 1.1, orientation: 'h' },
						yaxis: { title: unitLabel, gridcolor: '#ddd', fixedrange: true },
						xaxis: {
							rangeslider: { visible: true },
							showgrid: true, gridcolor: '#ddd'
						}
					}}
				/>
			</div>
		)
	}

}

/**
 * Determines the line graph's slider interval based after the slider is moved
 * @returns The slider interval, either 'all' or a TimeInterval
 */
export function getRangeSliderInterval(): string {
	const sliderContainer: any = document.querySelector('.rangeslider-bg');
	const sliderBox: any = document.querySelector('.rangeslider-slidebox');
	const root: any = document.getElementById('root');

	if (sliderContainer && sliderBox && root) {
		// Attributes of the slider: full width and the min & max values of the box
		const fullWidth: number = parseInt(sliderContainer.getAttribute('width'));
		const sliderMinX: number = parseInt(sliderBox.getAttribute('x'));
		const sliderMaxX: number = sliderMinX + parseInt(sliderBox.getAttribute('width'));
		if (sliderMaxX - sliderMinX === fullWidth) {
			return 'all';
		}

		// From the Plotly line graph, get current min and max times in seconds
		const minTimeStamp: number = parseInt(root.getAttribute('min-timestamp'));
		const maxTimeStamp: number = parseInt(root.getAttribute('max-timestamp'));

		// Seconds displayed on graph
		const deltaSeconds: number = maxTimeStamp - minTimeStamp;
		const secondsPerPixel: number = deltaSeconds / fullWidth;

		// Get the new min and max times, in seconds, from the slider box
		const newMinXTimestamp = Math.floor(minTimeStamp + (secondsPerPixel * sliderMinX));
		const newMaxXTimestamp = Math.floor(minTimeStamp + (secondsPerPixel * sliderMaxX));
		// The newMin/MaxTimestamp is equivalent to a Unix time in milliseconds. Thus, it will
		// shift with timezone. It isn't clear if we want it in local or UTC. It depends on what
		// plotly does. Here it is assumed that local is what is desired. This seems to work
		// and not shift the graphs x-axis so using.
		return new TimeInterval(moment(newMinXTimestamp), moment(newMaxXTimestamp)).toString();
	} else {
		throw new Error('unable to get range slider params');
	}
}

