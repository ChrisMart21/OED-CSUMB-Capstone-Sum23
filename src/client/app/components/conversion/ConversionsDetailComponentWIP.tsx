/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as React from 'react';
import { FormattedMessage } from 'react-intl';
import HeaderComponent from '../../components/HeaderComponent';
import SpinnerComponent from '../../components/SpinnerComponent';
import FooterContainer from '../../containers/FooterContainer';
import TooltipHelpContainer from '../../containers/TooltipHelpContainer';
import { conversionsApi } from '../../redux/api/conversionsApi';
import { unitsApi } from '../../redux/api/unitsApi';
import { ConversionData } from '../../types/redux/conversions';
import TooltipMarkerComponent from '../TooltipMarkerComponent';
import ConversionViewComponent from './ConversionViewComponent';
import CreateConversionModalComponentWIP from './CreateConversionModalComponentWIP';

/**
 * Defines the conversions page card view
 * @returns Conversion page element
 */
export default function ConversionsDetailComponent() {
	// The route stops you from getting to this page if not an admin.

	// Conversions state
	const { data: conversionsState = [], isFetching: conversionsFetching } = conversionsApi.useGetConversionsDetailsQuery();
	// Units DataById
	const { data: unitDataById = {}, isFetching: unitsFetching } = unitsApi.useGetUnitsDetailsQuery()
	// const x = useAppSelector(state => conversionsApi.endpoints.refresh.select()(state))

	// unnecessary? Currently this occurs as a side effect of the mutation which will invalidate meters/group
	// unused for now, until decided
	// const isUpdatingCikAndDBViews = useAppSelector(state => state.admin.isUpdatingCikAndDBViews);

	// Check if the units state is fully loaded

	const titleStyle: React.CSSProperties = {
		textAlign: 'center'
	};

	const tooltipStyle = {
		display: 'inline-block',
		fontSize: '50%',
		// For now, only an admin can see the conversion page.
		tooltipConversionView: 'help.admin.conversionview'
	};

	return (
		<div>
			{(conversionsFetching || unitsFetching) ? (
				<div className='text-center'>
					<SpinnerComponent loading width={50} height={50} />
					<FormattedMessage id='redo.cik.and.refresh.db.views'></FormattedMessage>
				</div>
			) : (
				<div>
					<HeaderComponent />
					<TooltipHelpContainer page='conversions' />

					<div className='container-fluid'>
						<h2 style={titleStyle}>
							<FormattedMessage id='conversions' />
							<div style={tooltipStyle}>
								<TooltipMarkerComponent page='conversions' helpTextId={tooltipStyle.tooltipConversionView} />
							</div>
						</h2>
						{unitDataById &&
							<div className="edit-btn">
								<CreateConversionModalComponentWIP />
							</div>}
						<div className="card-container">
							{/* Attempt to create a ConversionViewComponent for each ConversionData in Conversions State after sorting by
					the combination of the identifier of the source and destination of the conversion. */}
							{unitDataById && Object.values(conversionsState)
								.sort((conversionA: ConversionData, conversionB: ConversionData) =>
									((unitDataById[conversionA.sourceId].identifier + unitDataById[conversionA.destinationId].identifier).toLowerCase() >
										(unitDataById[conversionB.sourceId].identifier + unitDataById[conversionB.destinationId].identifier).toLowerCase()) ? 1 :
										(((unitDataById[conversionB.sourceId].identifier + unitDataById[conversionB.destinationId].identifier).toLowerCase() >
											(unitDataById[conversionA.sourceId].identifier + unitDataById[conversionA.destinationId].identifier).toLowerCase()) ? -1 : 0))
								.map(conversionData => (<ConversionViewComponent conversion={conversionData as ConversionData}
									key={String((conversionData as ConversionData).sourceId + '>' + (conversionData as ConversionData).destinationId)}
									units={unitDataById} />))}
						</div>
					</div>
					<FooterContainer />
				</div>
			)}
		</div>
	);
}