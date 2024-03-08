/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { combineReducers } from 'redux';
import { baseApi } from './api/baseApi';
import { adminPreference } from './slices/adminPreferenceSlice';
import { appStateSlice } from './slices/appStateSlice';
import { currentUserSlice } from './slices/currentUserSlice';
import { graphSlice } from './slices/graphSlice';
import maps from './reducers/maps';
import { localEditsSlice } from './slices/localEditsSlice';

export const rootReducer = combineReducers({
	appState: appStateSlice.reducer,
	graph: graphSlice.reducer,
	adminPreference: adminPreference.reducer,
	localEdits: localEditsSlice.reducer,
	currentUser: currentUserSlice.reducer,
	// RTK Query's Derived Reducers
	[baseApi.reducerPath]: baseApi.reducer,
	maps
});