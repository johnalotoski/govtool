import { PropsWithChildren, useEffect, useState } from "react";
import {
  Box,
  ButtonBase,
  CircularProgress,
  Collapse,
  LinearProgress,
} from "@mui/material";

import { Background, PagePaddingBox, ContentBox, Typography } from "@atoms";
import { Card, PageTitle } from "@molecules";
import { Footer, TopNav } from "@organisms";
import { DRepData, DRepListSort } from "@/models";
import { useGetDRepListInfiniteQuery } from "@hooks";
import { ICONS } from "@consts";

type ClassifiedDReps = {
  correct: DRepData[];
  incorrect: DRepData[];
  dbSyncCorrect: DRepData[];
  govToolCorrect: DRepData[];
};

type ErrorData = {
  drepId: string;
  errorType: string | null;
  error: string | null;
};

const DESCRIPTION = {
  correct: "DReps with correct metadata",
  incorrect: "DReps with incorrect metadata",
  dbSyncCorrect:
    "DReps whose metadata are considered correct by DBSync but incorrect by GovTool",
  govToolCorrect:
    "DReps whose metadata are considered correct by GovTool but incorrect by the DBSync",
};

export const DRepStats = () => {
  const [fetchedAll, setFetchedAll] = useState(false);
  const {
    dRepData: allDReps,
    dRepListTotalCount,
    dRepListHasNextPage,
    dRepListFetchNextPage,
  } = useGetDRepListInfiniteQuery(
    {
      pageSize: 16,
      sorting: DRepListSort.RegistrationDate,
    },
    {
      refetchOnWindowFocus: false,
      retry: 0,
    },
  );

  useEffect(() => {
    if (dRepListTotalCount && allDReps?.length === dRepListTotalCount) {
      setFetchedAll(true);
    }
    if (dRepListHasNextPage) {
      dRepListFetchNextPage();
    }
  }, [allDReps]);

  if (!dRepListTotalCount)
    return (
      <Wrapper>
        <Box
          sx={{
            display: "flex",
            flex: 1,
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress />
        </Box>
      </Wrapper>
    );

  const classifiedDReps = fetchedAll
    ? allDReps?.reduce<ClassifiedDReps>(
        (acc, dRep) => {
          const { metadataError, metadataValid } = dRep;
          if (!metadataError) {
            if (metadataValid) {
              acc.correct.push(dRep);
            } else {
              acc.dbSyncCorrect.push(dRep);
            }
          } else {
            if (metadataValid) {
              acc.govToolCorrect.push(dRep);
            } else {
              acc.incorrect.push(dRep);
            }
          }
          return acc;
        },
        {
          correct: [],
          incorrect: [],
          dbSyncCorrect: [],
          govToolCorrect: [],
        },
      )
    : null;

  return (
    <Wrapper>
      <Box pt={2}>
        <Typography variant="title2">
          Total DRep count: <strong>{dRepListTotalCount}</strong>
        </Typography>
      </Box>
      {dRepListTotalCount && !fetchedAll && (
        <Box sx={{ width: "100%", maxWidth: 600, pt: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Validating DReps metadata...
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((allDReps?.length ?? 0) / dRepListTotalCount) * 100}
            sx={{ borderRadius: 100, height: 8 }}
          />
        </Box>
      )}
      {fetchedAll && classifiedDReps && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            mt: 4,
          }}
        >
          {Object.entries(classifiedDReps).map(([key, dReps]) => (
            <DRepCategoryBox
              key={key}
              dReps={dReps}
              type={key as keyof ClassifiedDReps}
            />
          ))}
        </Box>
      )}
    </Wrapper>
  );
};

const getDBSyncErrorType = (error: string) => {
  if (error.includes("Hash mismatch")) {
    return "INVALID_HASH";
  }
  if (error.includes("expected JSON")) {
    return "INCORRECT_FORMAT";
  }
  if (error.includes("@language")) {
    return "MISSING_LANGUAGE";
  }
  if (error.includes("JSON decode error")) {
    return "INVALID_JSONLD";
  }
  if (error.includes("HandshakeFailed")) {
    return "INCORRECT_FORMAT (handshake failed)";
  }
  if (error.includes("status code : 404")) {
    return "URL_NOT_FOUND";
  }
  if (error.includes("Connection failure error")) {
    return "URL_NOT_FOUND";
  }
  if (error.includes("InvalidUrlException")) {
    return "URL_NOT_FOUND";
  }
  if (error.includes("status code : 403")) {
    return "URL_NOT_FOUND (forbidden)";
  }
  if (error.includes("status code : 999")) {
    return "URL_NOT_FOUND (request denied)";
  }
  if (error.includes("Timeout error")) {
    return "URL_NOT_FOUND (timeout)";
  }
  return error;
};

const DRepCategoryBox = ({
  dReps,
  type,
}: {
  dReps: DRepData[];
  type: keyof ClassifiedDReps;
}) => {
  const errors = ((): ErrorData[] => {
    switch (type) {
      case "correct":
        return [];
      case "incorrect":
        return dReps.map(({ drepId, metadataError, metadataStatus }) => {
          const dbSyncStatus =
            metadataError && getDBSyncErrorType(metadataError);
          if (dbSyncStatus?.startsWith(metadataStatus ?? "")) {
            return {
              drepId,
              errorType: dbSyncStatus,
              error: metadataError,
            };
          }
          return {
            drepId,
            errorType: "AMBIGUOUS",
            error: `${metadataStatus} (GovTool) / ${dbSyncStatus} (DBSync): ${metadataError}`,
          };
        });
      case "dbSyncCorrect":
        return dReps.map(({ drepId, metadataStatus, url }) => ({
          drepId,
          errorType: metadataStatus,
          error: metadataStatus === "URL_NOT_FOUND" ? url ?? null : "",
        }));
      case "govToolCorrect":
        return dReps.map(({ drepId, metadataError }) => ({
          drepId,
          errorType: metadataError && getDBSyncErrorType(metadataError),
          error: metadataError,
        }));
      default:
        return [];
    }
  })();

  const groupedErrors = errors.reduce<Record<string, ErrorData[]>>((acc, e) => {
    if (!e.errorType) return acc;
    if (!acc[e.errorType]) {
      acc[e.errorType] = [];
    }
    acc[e.errorType].push(e);
    return acc;
  }, {});

  return (
    <Card>
      <Typography variant="body1">{DESCRIPTION[type]}</Typography>
      <Typography variant="headline2">{dReps.length}</Typography>
      {!!errors.length && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "start",
            mt: 2,
          }}
        >
          {Object.entries(groupedErrors)
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
            .map(([type, errors]) => (
              <ErrorGroup key={type} type={type} errors={errors} />
            ))}
        </Box>
      )}
    </Card>
  );
};

const ErrorGroup = ({
  type,
  errors,
}: {
  type: string;
  errors: ErrorData[];
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <ButtonBase
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          py: 0.5,
        }}
      >
        <img src={ICONS.arrowDownIcon} style={{ width: 8 }} />
        <Typography variant="caption">{type}:</Typography>
        <Typography variant="caption">
          <strong>{errors.length}</strong>
        </Typography>
      </ButtonBase>
      <Collapse in={open}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            pt: 1,
            pb: 3,
            pl: 2,
          }}
        >
          {errors
            .sort((a, b) =>
              !a.error || !b.error ? 0 : a.error.localeCompare(b.error),
            )
            .map(({ drepId, error }) => (
              <Typography variant="caption" key={drepId}>
                {error}
              </Typography>
            ))}
        </Box>
      </Collapse>
    </Box>
  );
};

const Wrapper = ({ children }: PropsWithChildren) => (
  <Background>
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopNav />

      <PageTitle title="DRep Stats" />

      <PagePaddingBox sx={{ display: "flex", flex: 1, py: 2 }}>
        <ContentBox sx={{ display: "flex", flex: 1, flexDirection: "column" }}>
          {children}
        </ContentBox>
      </PagePaddingBox>
      <Footer />
    </Box>
  </Background>
);
