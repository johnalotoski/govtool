import { useInfiniteQuery } from "react-query";

import { QUERY_KEYS } from "@consts";
import { useCardano } from "@context";
import { getProposals, getProposalsArguments } from "@services";

export const useGetProposalsInfiniteQuery = ({
  filters = [],
  pageSize = 10,
  sorting = "",
}: getProposalsArguments) => {
  const { dRepID, isEnabled, pendingTransaction } = useCardano();

  const fetchProposals = ({ pageParam = 0 }) =>
    getProposals({
      dRepID,
      filters,
      page: pageParam,
      pageSize,
      sorting,
    });

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery(
    [
      QUERY_KEYS.useGetProposalsInfiniteKey,
      dRepID,
      filters,
      isEnabled,
      pendingTransaction.vote,
      sorting,
    ],
    fetchProposals,
    {
      getNextPageParam: (lastPage) => {
        if (lastPage.elements.length === 0) {
          return undefined;
        }
        return lastPage.page + 1;
      },
      refetchInterval: 20000,
    },
  );

  const proposals = data?.pages.flatMap(
    (page) => page.elements,
  ) as ActionType[];

  return {
    proposalsfetchNextPage: fetchNextPage,
    proposalsHaveNextPage: hasNextPage,
    isProposalsFetching: isFetching,
    isProposalsFetchingNextPage: isFetchingNextPage,
    isProposalsLoading: isLoading,
    proposals,
  };
};
