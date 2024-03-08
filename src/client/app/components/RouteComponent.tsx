/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import * as React from 'react';
import { IntlProvider } from 'react-intl';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import UploadCSVContainer from '../containers/csv/UploadCSVContainer';
import MapCalibrationContainer from '../containers/maps/MapCalibrationContainer';
import { useAppSelector } from '../redux/reduxHooks';
import LocaleTranslationData from '../translations/data';
import { UserRole } from '../types/items';
import AppLayout from './AppLayout';
import HomeComponent from './HomeComponent';
import LoginComponent from './LoginComponent';
import AdminComponent from './admin/AdminComponent';
import UsersDetailComponent from './admin/UsersDetailComponent';
import ConversionsDetailComponent from './conversion/ConversionsDetailComponent';
import GroupsDetailComponent from './groups/GroupsDetailComponent';
import MetersDetailComponent from './meters/MetersDetailComponent';
import AdminOutlet from './router/AdminOutlet';
import { GraphLink } from './router/GraphLinkComponent';
import NotFound from './router/NotFoundOutlet';
import RoleOutlet from './router/RoleOutlet';
import UnitsDetailComponent from './unit/UnitsDetailComponent';
import ErrorComponent from './router/ErrorComponent';
import { selectSelectedLanguage } from '../redux/slices/appStateSlice';
import CreateUserComponent from './admin/CreateUserComponent';
import MapsDetailComponent from './maps/MapsDetailComponentWIP';

/**
 * @returns the router component Responsible for client side routing.
 */
export default function RouteComponent() {
	const lang = useAppSelector(selectSelectedLanguage);
	const messages = (LocaleTranslationData)[lang];
	return (
		<IntlProvider locale={lang} messages={messages} key={lang}>
			<RouterProvider router={router} />
		</IntlProvider>
	);
}

// Router Responsible for client side routing.
const router = createBrowserRouter([
	{
		// TODO Error Component needs to be implemented, Its currently a bare bones placeholder
		path: '/', element: <AppLayout />, errorElement: <ErrorComponent />,
		children: [
			{ index: true, element: <HomeComponent /> },
			{ path: 'login', element: <LoginComponent /> },
			{ path: 'groups', element: <GroupsDetailComponent /> },
			{ path: 'meters', element: <MetersDetailComponent /> },
			{ path: 'graph', element: <GraphLink /> },
			{
				element: <AdminOutlet />,
				children: [
					{ path: 'admin', element: <AdminComponent /> },
					{ path: 'calibration', element: <MapCalibrationContainer /> },
					{ path: 'maps', element: <MapsDetailComponent /> },
					{ path: 'users/new', element: <CreateUserComponent /> },
					{ path: 'units', element: <UnitsDetailComponent /> },
					{ path: 'conversions', element: <ConversionsDetailComponent /> },
					{ path: 'users', element: <UsersDetailComponent /> }
				]
			},
			{
				element: <RoleOutlet role={UserRole.CSV} />,
				children: [
					{ path: 'csv', element: <UploadCSVContainer /> }
				]
			},
			{ path: '*', element: <NotFound /> }
		]
	}
]);