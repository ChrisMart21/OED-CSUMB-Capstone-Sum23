/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
// @ts-nocheck
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// TODO: Migrate to RTK

import * as moment from 'moment';
import { ActionType, Dispatch, GetState, Thunk } from '../../types/redux/actions';
import * as t from '../../types/redux/map';
import { CalibrationModeTypes, MapData, MapMetadata } from '../../types/redux/map';
import ApiBackend from '../../utils/api/ApiBackend';
import MapsApi from '../../utils/api/MapsApi';
import { calibrate, CalibratedPoint, CalibrationResult, CartesianPoint, GPSPoint } from '../../utils/calibration';
import { browserHistory } from '../../utils/history';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';
import translate from '../../utils/translate';
import { logToServer } from './logs';
import { RootState } from 'store';

const mapsApi = new MapsApi(new ApiBackend());

function requestMapsDetails(): t.RequestMapsDetailsAction {
	return { type: ActionType.RequestMapsDetails };
}

function receiveMapsDetails(data: MapData[]): t.ReceiveMapsDetailsAction {
	return { type: ActionType.ReceiveMapsDetails, data };
}

function submitMapEdits(mapID: number): t.SubmitEditedMapAction {
	return { type: ActionType.SubmitEditedMap, mapID };
}

function confirmMapEdits(mapID: number): t.ConfirmEditedMapAction {
	return { type: ActionType.ConfirmEditedMap, mapID };
}

export function fetchMapsDetails(): Thunk {
	return async (dispatch: Dispatch) => {
		dispatch(requestMapsDetails());
		try {
			const mapsDetails = await mapsApi.details();
			dispatch(receiveMapsDetails(mapsDetails));
		} catch (error) {
			showErrorNotification(translate('failed.to.fetch.maps'));
		}
	};
}

export function editMapDetails(map: MapMetadata): t.EditMapDetailsAction {
	return { type: ActionType.EditMapDetails, map };
}

function incrementCounter(): t.IncrementCounterAction {
	return { type: ActionType.IncrementCounter };
}

export function setNewMap(): Thunk {
	return async (dispatch: Dispatch) => {
		dispatch(incrementCounter());
		dispatch((dispatch2: Dispatch, getState2: GetState) => {
			const temporaryID = getState2().maps.newMapCounter * -1;
			dispatch2(logToServer('info', `Set up new map, id = ${temporaryID}`));
			dispatch2(setCalibration(CalibrationModeTypes.initiate, temporaryID));
		});
	};
}

/**
 * start a new calibration session
 * @param mode calibration modes
 * @param mapID id of map being calibrated
 */
export function setCalibration(mode: CalibrationModeTypes, mapID: number): Thunk {
	return async (dispatch: Dispatch) => {
		dispatch(prepareCalibration(mode, mapID));
		dispatch((dispatch2: Dispatch) => {
			dispatch2(logToServer('info', `Start Calibration for map, id=${mapID}, mode:${mode}`));
		});
	};
}

export function prepareCalibration(mode: CalibrationModeTypes, mapID: number): t.SetCalibrationAction {
	return { type: ActionType.SetCalibration, mode, mapID };
}

/**
 * toggle display of grids during calibration
 */
export function changeGridDisplay(): t.ChangeGridDisplayAction {
	return { type: ActionType.ChangeGridDisplay };
}

/**
 * drop present calibration session in a traceable manner
 */
export function dropCalibration(): Thunk {
	return async (dispatch: Dispatch, getState: GetState) => {
		const mapToReset = getState().maps.calibratingMap;
		dispatch(resetCalibration(mapToReset));
		dispatch((dispatch2: Dispatch) => {
			dispatch2(logToServer('info', `reset calibration for map, id: ${mapToReset}.`));
		});
	};
}

function resetCalibration(mapToReset: number): t.ResetCalibrationAction {
	return { type: ActionType.ResetCalibration, mapID: mapToReset };
}

export function updateMapSource(data: MapMetadata): t.UpdateMapSourceAction {
	return { type: ActionType.UpdateMapSource, data };
}

export function updateMapMode(nextMode: CalibrationModeTypes): t.ChangeMapModeAction {
	return { type: ActionType.UpdateCalibrationMode, nextMode };
}

/**
 * Changes the selected map ID
 * @param newSelectedMapID new map ID
 */
export function changeSelectedMap(newSelectedMapID: number): t.UpdateSelectedMapAction {
	return { type: ActionType.UpdateSelectedMap, mapID: newSelectedMapID };
}

export function updateCurrentCartesian(currentCartesian: CartesianPoint): t.UpdateCurrentCartesianAction {
	return { type: ActionType.UpdateCurrentCartesian, currentCartesian };
}

/**
 * pair collected GPS coordinate with cartesian coordinate to form a complete data point,
 * append to calibration set and trigger calibration if needed
 * @param currentGPS GPS data, from user input
 */
export function offerCurrentGPS(currentGPS: GPSPoint): Thunk {
	return (dispatch: Dispatch, getState: GetState) => {
		const mapID = getState().localEdits.calibratingMap;
		const point = getState().localEdits.mapEdits.entities[mapID].currentPoint;
		if (point && hasCartesian(point)) {
			point.gps = currentGPS;
			dispatch(updateCalibrationSet(point));
			dispatch(resetCurrentPoint());
			// Nesting dispatches to preserve that updateCalibrationSet() is called before calibration
			dispatch(async (dispatch2: Dispatch) => {
				dispatch2(logToServer('info', `gps input (lat:${currentGPS.latitude},long:${currentGPS.longitude})
				provided for cartesian point:${point.cartesian.x},${point.cartesian.y}
				and added to data point`));
				if (isReadyForCalculation(getState())) {
					const result = prepareDataToCalculation(getState());
					dispatch2(updateResult(result));
					dispatch2(logToServer('info', `calculation complete, maxError: x:${result.maxError.x},y:${result.maxError.y},
					origin:${result.origin.latitude},${result.origin.longitude}, opposite:${result.opposite.latitude},${result.opposite.longitude}`));
				} else {
					dispatch2(logToServer('info', 'threshold not met, didn\'t trigger calibration'));
				}
			});
		}
		return Promise.resolve();
	};
}

export function hasCartesian(point: CalibratedPoint) {
	return point.cartesian.x !== -1 && point.cartesian.y !== -1;
}

function updateCalibrationSet(calibratedPoint: CalibratedPoint): t.AppendCalibrationSetAction {
	return { type: ActionType.AppendCalibrationSet, calibratedPoint };
}

/**
 * use a default number as the threshold in determining if it's safe to call the calibration function
 * @param state The redux state
 * @returns Result of safety check
 */
function isReadyForCalculation(state: RootState): boolean {
	const calibrationThreshold = 3;
	// assume calibrationSet is defined, as offerCurrentGPS indicates through point that the map is defined.
	return state.localEdits.mapEdits.entities[state.localEdits.calibratingMap].calibrationSet.length >= calibrationThreshold;
}

/**
 *  prepare data to required formats to pass it to function calculating mapScales
 * @param state The redux state
 * @returns Result of map calibration
 */
function prepareDataToCalculation(state: RootState): CalibrationResult {
	// TODO FIX BEFORE PR
	const mapID = state.localEdits.calibratingMap;
	const mp = state.localEdits.mapEdits.entities[mapID];
	// Since mp is defined above, calibrationSet is defined.
	/* eslint-disable @typescript-eslint/no-non-null-assertion */
	const result = calibrate(mp);
	return result;
	/* eslint-enable @typescript-eslint/no-non-null-assertion */
}

function updateResult(result: CalibrationResult): t.UpdateCalibrationResultAction {
	return { type: ActionType.UpdateCalibrationResults, result };
}

export function resetCurrentPoint(): t.ResetCurrentPointAction {
	return { type: ActionType.ResetCurrentPoint };
}

export function submitEditedMaps(): Thunk {
	return async (dispatch: Dispatch, getState: GetState) => {
		Object.keys(getState().maps.editedMaps).forEach(mapID2Submit => {
			const mapID = parseInt(mapID2Submit);
			if (getState().maps.submitting.indexOf(mapID) === -1) {
				dispatch(submitEditedMap(mapID));
			}
		});
	};
}

export function submitCalibratingMap(): Thunk {
	return async (dispatch: Dispatch, getState: GetState) => {
		const mapID = getState().maps.calibratingMap;
		if (mapID < 0) {
			dispatch(submitNewMap());
		} else {
			dispatch(submitEditedMap(mapID));
		}
	};
}

/**
 * submit a new map to database at the end of a calibration session
 */
export function submitNewMap(): Thunk {
	return async (dispatch: Dispatch, getState: GetState) => {
		const mapID = getState().maps.calibratingMap;
		const map = getState().maps.editedMaps[mapID];
		try {
			const acceptableMap: MapData = {
				...map,
				mapSource: map.mapSource,
				displayable: false,
				modifiedDate: moment().toISOString(),
				origin: map.calibrationResult?.origin,
				opposite: map.calibrationResult?.opposite
			};
			await mapsApi.create(acceptableMap);
			if (map.calibrationResult) {
				dispatch(logToServer('info', 'New calibrated map uploaded to database'));
				showSuccessNotification(translate('upload.new.map.with.calibration'));
			} else {
				dispatch(logToServer('info', 'New map uploaded to database(without calibration)'));
				showSuccessNotification(translate('upload.new.map.without.calibration'));
			}
			dispatch(confirmMapEdits(mapID));
			browserHistory.push('/maps');
		} catch (e) {
			showErrorNotification(translate('failed.to.create.map'));
			dispatch(logToServer('error', `failed to create map, ${e}`));
		}
	};
}

/**
 * submit changes of an existing map to database at the end of a calibration session
 * @param mapID the edited map being updated at database
 */
export function submitEditedMap(mapID: number): Thunk {
	return async (dispatch: Dispatch, getState: GetState) => {
		const map = getState().maps.editedMaps[mapID];
		dispatch(submitMapEdits(mapID));
		try {
			const acceptableMap: MapData = {
				...map,
				mapSource: map.mapSource,
				// As in other place, this take the time, in this case the current time, grabs the
				// date and time without timezone and then set it to UTC. This allows the software
				// to recreate it with the same date/time as it is on this web browser when it is
				// displayed later (without the timezone shown).
				// It might be better to use the server time but this is good enough.
				modifiedDate: moment().format('YYYY-MM-DD HH:mm:ss') + '+00:00',
				origin: map.calibrationResult?.origin,
				opposite: map.calibrationResult?.opposite,
				circleSize: map.circleSize
			};
			await mapsApi.edit(acceptableMap);
			if (map.calibrationResult) {
				dispatch(logToServer('info', 'Edited map uploaded to database(newly calibrated)'));
				showSuccessNotification(translate('updated.map.with.calibration'));
			} else if (map.origin && map.opposite) {
				dispatch(logToServer('info', 'Edited map uploaded to database(calibration not updated)'));
				showSuccessNotification(translate('updated.map.without.new.calibration'));
			} else {
				dispatch(logToServer('info', 'Edited map uploaded to database(without calibration)'));
				showSuccessNotification(translate('updated.map.without.calibration'));
			}
			dispatch(confirmMapEdits(mapID));
		} catch (err) {
			showErrorNotification(translate('failed.to.edit.map'));
			dispatch(logToServer('error', `failed to edit map, ${err}`));
		}
	};
}

/**
 * permanently remove a map
 * @param mapID map to be removed
 */
export function removeMap(mapID: number): Thunk {
	return async (dispatch: Dispatch) => {
		try {
			await mapsApi.delete(mapID);
			dispatch(deleteMap(mapID));
			dispatch(logToServer('info', `Deleted map, id = ${mapID}`));
			showSuccessNotification(translate('map.is.deleted'));
			browserHistory.push('/maps');
		} catch (err) {
			showErrorNotification(translate('failed.to.delete.map'));
			dispatch(logToServer('error', `Failed to delete map, id = ${mapID}, ${err}`));
		}
	};
}

function deleteMap(mapID: number): t.DeleteMapAction {
	return { type: ActionType.DeleteMap, mapID };
}

/**
 * Remove all the maps in editing without submitting them
 */
export function confirmEditedMaps() {
	return async (dispatch: Dispatch, getState: GetState) => {
		Object.keys(getState().maps.editedMaps).forEach(mapID2Submit => {
			const mapID = parseInt(mapID2Submit);
			dispatch(confirmMapEdits(mapID));
		});
	};
}
