// import * as React from 'react';
import { groupsApi } from './api/groupsApi';
import { metersApi } from './api/metersApi';
import { readingsApi } from './api/readingsApi';
import { useAppSelector } from './hooks';
import { selectChartQueryArgs } from './selectors/dataSelectors';
import { unitsApi } from './api/unitsApi';

// General purpose custom hook mostly useful for Select component loadingIndicators, and current graph loading state(s)
export const getFetchingStates = () => {
	const queryArgs = useAppSelector(state => selectChartQueryArgs(state));
	const { isFetching: meterLineIsFetching, isLoading: meterLineIsLoading } = readingsApi.endpoints.line.useQueryState(queryArgs.line.meterArgs);
	const { isFetching: groupLineIsFetching, isLoading: groupLineIsLoading } = readingsApi.endpoints.line.useQueryState(queryArgs.line.groupsArgs);
	const { isFetching: meterBarIsFetching, isLoading: meterBarIsLoading } = readingsApi.endpoints.bar.useQueryState(queryArgs.bar.meterArgs);
	const { isFetching: groupBarIsFetching, isLoading: groupBarIsLoading } = readingsApi.endpoints.bar.useQueryState(queryArgs.bar.groupsArgs);
	const { isFetching: threeDIsFetching, isLoading: threeDIsLoading } = readingsApi.endpoints.threeD.useQueryState(queryArgs.threeD.args);
	const { isFetching: metersFetching, isLoading: metersLoading } = metersApi.endpoints.getMeters.useQueryState();
	const { isFetching: groupsFetching, isLoading: groupsLoading } = groupsApi.endpoints.getGroups.useQueryState();
	const { isFetching: unitsIsFetching, isLoading: unitsIsLoading } = unitsApi.endpoints.getUnitsDetails.useQueryState();


	return {
		endpointsFetchingData: {
			lineMeterReadings: { meterLineIsFetching, meterLineIsLoading },
			lineGroupReadings: { groupLineIsFetching, groupLineIsLoading },
			barMeterReadings: { meterBarIsFetching, meterBarIsLoading },
			barGroupReadings: { groupBarIsFetching, groupBarIsLoading },
			threeDReadings: { threeDIsFetching, threeDIsLoading },
			meterData: { metersFetching, metersLoading },
			groupData: { groupsFetching, groupsLoading },
			unitsData: { unitsIsFetching, unitsIsLoading }
		},
		somethingIsFetching: meterLineIsFetching ||
			groupLineIsFetching ||
			meterBarIsFetching ||
			groupBarIsFetching ||
			threeDIsFetching ||
			metersFetching ||
			groupsFetching ||
			unitsIsFetching

	}
	// Since we're deriving data, we can useMemo() for stable references.
	// const fetchInfo = React.useMemo(() => ({
	// 	endpointsFetchingData: {
	// 		meterLineIsLoading,
	// 		groupLineIsLoading,
	// 		meterBarIsLoading,
	// 		groupBarIsLoading,
	// 		threeDIsLoading,
	// 		metersLoading,
	// 		groupsLoading,
	// 		unitsIsLoading
	// 	},
	// 	somethingIsFetching: meterLineIsLoading ||
	// 		groupLineIsLoading ||
	// 		meterBarIsLoading ||
	// 		groupBarIsLoading ||
	// 		threeDIsLoading ||
	// 		metersLoading ||
	// 		groupsLoading ||
	// 		unitsIsLoading

	// }
	// ), [
	// 	meterLineIsLoading, groupLineIsLoading,
	// 	meterBarIsLoading, groupBarIsLoading,
	// 	threeDIsLoading, metersLoading,
	// 	groupsLoading, unitsIsLoading
	// ])

}