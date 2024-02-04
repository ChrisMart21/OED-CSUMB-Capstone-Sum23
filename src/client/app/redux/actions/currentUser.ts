/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { usersApi, verificationApi } from '../../utils/api';
import { Thunk,  Dispatch, GetState } from '../../types/redux/actions';
import { State } from '../../types/redux/state';
import { deleteToken, hasToken } from '../../utils/token';
import { currentUserSlice } from '../slices/currentUserSlice';

// TODO Marked For Deletion after RTK migration solidified
/* eslint-disable jsdoc/check-param-names */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
/* eslint-disable jsdoc/require-param */
/**
 * Check if we should fetch the current user's data. This function has the side effect of deleting an invalid token from local storage.
 * @param state The redux state
 * @returns Return true if we should fetch the current user's data. Returns false otherwise.
 */
async function shouldFetchCurrentUser(state: State): Promise<boolean> {
	// If we are currently fetching the current user, we should not fetch the data again.
	if (!state.currentUser.isFetching) {
		if (hasToken()) {
			// If we have a token, we should check to see if it is valid.
			if (await verificationApi.checkTokenValid()) {
				// If the token is valid, we should fetch the current user's data.
				return true;
			} else {
				deleteToken(); // We should delete the token when we know that it is invalid. This helps ensure that we do not keep an invalid token.
				return false;
			}
		} else {
			return false;
		}
	} else {
		return false;
	}
}

export function fetchCurrentUser(): Thunk {
	return async (dispatch: Dispatch) => {
		dispatch(currentUserSlice.actions.requestCurrentUser());
		const user = await usersApi.getCurrentUser();
		return dispatch(currentUserSlice.actions.receiveCurrentUser(user));
	};
}

export function fetchCurrentUserIfNeeded(): Thunk {
	return async (dispatch: Dispatch, getState: GetState) => {
		if (await shouldFetchCurrentUser(getState())) {
			return dispatch(fetchCurrentUser());
		}
		return Promise.resolve();
	};
}