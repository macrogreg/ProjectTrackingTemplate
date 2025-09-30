//
// Work item cost estimation logic.
// See https://github.com/macrogreg/ProjectTrackingTemplate for info.
//


// Module imports:
const axios = require('axios');


// Configure the lookup table for the work item cost estimates.
// This is a 2D table `ESTIMATED_COST_IN_DAYS[size][risk]` with cells containing the estimated effort in
// working days, given the item's Size and Risk.
// This doc explains how the numbers are determined:
// https://github.com/macrogreg/ProjectTrackingTemplate#estimating-work-items-and-computing-time-effort
function createEstimatedCostLookupTable() {

    function estimatedCostTableRow(low, mid, high, severe) {
        return {
            ["LOW"]: low,
            ["MID"]: mid, 
            ["HIGH"]: high,
            ["SEVERE"]: severe
        };
    }

    const EstimatedCostInDays = {
        ["XS"]: estimatedCostTableRow(  0.5,   1,   1.5,   4),
        ["S"]:  estimatedCostTableRow(  2,     3,   4.5,  12),
        ["M"]:  estimatedCostTableRow(  4,     5,   7.5,  20),
        ["L"]:  estimatedCostTableRow(  7.5,  10,  15,    40),
        ["XL"]: estimatedCostTableRow( 15,    20,  30,    80),
    };

    return EstimatedCostInDays;
}

const ESTIMATED_COST_IN_DAYS = createEstimatedCostLookupTable();


// Read Env parameters. GH workflow calling this script should set them up.
function loadEnvParameters() {

    const tokenTargetProjectRW = process.env.TOKEN_TARGET_PROJECT_RW;
    const varTargetProjectOwnerType = process.env.VAR_TARGET_PROJECT_OWNER_TYPE;
    const varTargetProjectOwnerName = process.env.VAR_TARGET_PROJECT_OWNER_NAME;
    const varTargetProjectNumberId = process.env.VAR_TARGET_PROJECT_NUMBER_ID;

    if (!tokenTargetProjectRW) {
        throw new Error("`TOKEN_TARGET_PROJECT_RW` is missing.");
    }

    if (!varTargetProjectOwnerType) {
        throw new Error("`VAR_TARGET_PROJECT_OWNER_TYPE` is missing.");
    } else {
        if (typeof varTargetProjectOwnerType !== "string") {
            throw new Error("`VAR_TARGET_PROJECT_OWNER_TYPE` is not a string.");
        }

        let ownerTypeLower = varTargetProjectOwnerType.toLowerCase();
        if (ownerTypeLower !== "organization"
                && ownerTypeLower !== "user") {
            throw new Error(
                "`VAR_TARGET_PROJECT_OWNER_TYPE` is '" + varTargetProjectOwnerType
                + "', but one of the following was expected: ['organization', 'user'].");
        }
    }

    if (!varTargetProjectOwnerName) {
        throw new Error("`VAR_TARGET_PROJECT_OWNER_NAME` is missing.");
    }

    if (!varTargetProjectNumberId) {
        throw new Error("`VAR_TARGET_PROJECT_NUMBER_ID` is missing.");
    }

    return {
        tokenTargetProjectRW,
        varTargetProjectOwnerType,
        varTargetProjectOwnerName,
        varTargetProjectNumberId
    };
}


// Lookup the estimated work item cost in days from the `ESTIMATED_COST_IN_DAYS` table
// using the specified `size` and `risk`.
//     `size` comes in form: "Code (explanation)", e.g. "XS (1 ≤ day)"
//     `risk` comes in form: "Code: explanation", e.g. "Low: well-understood".
// Codes are parsed out and used for look-ups.
function lookupEstimatedCost(size, risk) {

    const sizeKey = size?.split('(')[0].trim().toUpperCase();
    const riskKey = risk?.split(':')[0].trim().toUpperCase();

    if (!(sizeKey in ESTIMATED_COST_IN_DAYS)) {
        const errMsg = `Invalid Size specifier: original value: "${size}"; key: "${sizeKey}".`;
        console.log(errMsg);
        throw new Error(errMsg);
    }

    const costTableRow = ESTIMATED_COST_IN_DAYS[sizeKey];

    if (!(riskKey in costTableRow)) {
        const errMsg = `Invalid Risk specifier: original value: "${risk}"; key: "${riskKey}".`;
        console.log(errMsg);
        throw new Error(errMsg);
    }

    const estimate = costTableRow[riskKey];
    // console.log(`ESTIMATED_COST_IN_DAYS[${sizeKey}][${riskKey}]: '${estimate}'`);
    return estimate;
}


// Execute a GraphGL call against the GitHub API.
async function graphql(query, variables, bearerToken) {

    const EndpointUrl = "https://api.github.com/graphql";

    const res = await axios.post(
        EndpointUrl,
        { query, variables },
        {
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (res.data.errors) {        
        const errInfo = JSON.stringify(res.data, null, 2)
        console.error(
            "GraphQL call resulted in error.",
            errInfo
        );
        throw new Error("GraphQL error. " + errInfo);
    }

    return res.data;
};


// GitHub GraphGL uses entity IDs to refer to items. This function looks up the respective ID needed to run later
// queries. E.g. the ID of the target project, and the ID of the estimate field.
async function getFieldIds(envParams) {

    const ownerType = envParams.varTargetProjectOwnerType.toLowerCase();
    const projectNumber = parseInt(envParams.varTargetProjectNumberId, 10);

    const query = `
        query($ownerName: String!, $projectNumber: Int!) {
            `+ownerType+`(login: $ownerName) {
                projectV2(number: $projectNumber) {
                    id
                    fields(first: 100) {
                        nodes {
                            ... on ProjectV2SingleSelectField {
                                id
                                name
                            }
                            ... on ProjectV2FieldCommon {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
    `;

    console.log("\n===========-===========-===========-===========-===========");
    console.log("Getting GraphQL IDs for Target Project...");
    console.log("    Security token: '..." + envParams.tokenTargetProjectRW.slice(-4) + "'.");
    console.log("    Owner type:     '" + ownerType + "'.");
    console.log("    Owner name:     '" + envParams.varTargetProjectOwnerName + "'.");
    console.log("    Project number: " + projectNumber + ".");

    const data = await graphql(
        query,
        {
            ownerName: envParams.varTargetProjectOwnerName,
            projectNumber
        },
        envParams.tokenTargetProjectRW
    );

    const ownerData = (ownerType === "organization") ? data.data.organization
                        : (ownerType === "user") ? data.data.user
                        : undefined;

    if (!ownerData) {
        console.error("The getFieldIds query did not fail, but the owner data is not available"
                    + " (ownerType = '"+ownerType+"'). Fatal errors will likely follow.");
    }

    const getFieldIdByName = (name) => {
        const fields = ownerData.projectV2.fields.nodes;
        const field = fields.find(f => f.name.toLowerCase() === name.toLowerCase());

        if (!field) {
            throw new Error(`Field "${name}" not found`);
        }

        return field.id;
    };

    const fieldIds = {
        daysEstimateFieldId: getFieldIdByName("Days Estimate"),
        projectId: ownerData.projectV2.id
    };

    console.log("GraphQL IDs retrieved.");
    console.log("    `Days Estimate` field: '" + fieldIds.daysEstimateFieldId + "'.");
    console.log("    Target project:        '" + fieldIds.projectId + "'.");

    return fieldIds;
}


// Gets all project work items. Uses paging (100 batches).
// This should work for projects with several 1000s of items, but we have not perf-tested it for projects with 
// several tens of thousands, let alone several hundreds of thousands of items.
async function getProjectItems(projectId, tokenTargetProjectRW) {
    const query = `
        query($projectId: ID!, $cursor: String) {
            node(id: $projectId) {
                ... on ProjectV2 {
                    items(first: 100, after: $cursor) {
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                        nodes {
                            id
                            content {
                                ... on DraftIssue {
                                    title
                                }
                                ... on Issue {
                                    title
                                }
                                ... on PullRequest {
                                    title
                                }
                            }
                            fieldValues(first: 50) {
                                nodes {
                                    ... on ProjectV2ItemFieldSingleSelectValue {
                                        name
                                        field {
                                            ... on ProjectV2FieldCommon {
                                                name
                                            }
                                        }
                                    }
                                    ... on ProjectV2ItemFieldNumberValue {
                                        number
                                        field {
                                            ... on ProjectV2FieldCommon {
                                                name
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    let items = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
        const variables = {
            projectId: projectId,
            cursor: cursor,
        };

        const data = await graphql(query, variables, tokenTargetProjectRW);
        const page = data.data.node.items;

        items.push(...page.nodes);
        hasNextPage = page.pageInfo.hasNextPage;
        cursor = page.pageInfo.endCursor;
    }

    return items;
}


// Sets the estimate field of the specified item to the specified value.
async function updateDaysEstimate(projectId, itemId, fieldId, newValue, tokenTargetProjectRW) {

    const mutation = `
        mutation($input: UpdateProjectV2ItemFieldValueInput!) {
            updateProjectV2ItemFieldValue(input: $input) {
                projectV2Item {
                    id
                }
            }
        }
    `;

    await graphql(
        mutation,
        {
            input: {
                projectId,
                itemId,
                fieldId,
                value: {
                    number: newValue
                }
            }
        },
        tokenTargetProjectRW
    );
}


// Read Env params, get IDs to use for GraphQL lookups, get all work items from the target project.
// For each work item:
//     Get `Size` and `Risk`, compute the corresponding `Days Estimate` that the item should have;
//     Get the actual `Days Estimate` set on the item. If it differs from what it should be, update accordingly;
// Handle counts, totals, errors.
async function main() {

    const envParams = loadEnvParameters();
    const tokenTargetProjectRW = envParams.tokenTargetProjectRW;

    const { daysEstimateFieldId, projectId } = await getFieldIds(envParams);

    const items = await getProjectItems(projectId, tokenTargetProjectRW);

    let countTotalItems = 0;
    let countChangedItems = 0;
    let countErrItems = 0;
    for (const item of items) {

        try {
            countTotalItems++;
            const title = item.content?.title || "<no title>";

            console.log("\n===========-===========-===========-===========-===========");
            console.log(`Item #${countTotalItems}: id='${item.id}', title="${title}".`);

            const fields = item.fieldValues.nodes ?? [];

            const size = fields.find(f => f.field?.name.toLowerCase() === "size")?.name;
            const risk = fields.find(f => f.field?.name.toLowerCase() === "risk")?.name;

            console.log(`Size = '${size ?? "<unspecified>"}'.`);
            console.log(`Risk = '${risk ?? "<unspecified>"}'.`);

            if (!size) {
                console.log("Skipping item: missing Size.");
                continue;
            }

            if (!risk) {
                console.log("Skipping item: missing Risk.");
                continue;
            }

            const estimate = lookupEstimatedCost(size, risk);
            console.log(`Computed Estimate = '${estimate ?? "<not available>"}'.`);

            const existingEstimate = fields.find(f => f.field?.name.toLowerCase() === "days estimate")?.number;
            console.log(`Exiting Estimate  = '${existingEstimate ?? "<not available>"}'.`);

            const isUpdateNeeded = (existingEstimate !== estimate);
            console.log(`Is Update Needed  = '${isUpdateNeeded}'.`);

            if (!isUpdateNeeded) {
                console.log("Skipping update.");
                continue;
            }

            await updateDaysEstimate(projectId, item.id, daysEstimateFieldId, estimate, tokenTargetProjectRW);
            countChangedItems++;

            console.log(`Item #${countTotalItems} updated. This was update #${countChangedItems}.`);
            
        } catch(err) {
            countErrItems++;
            
            const title = item.content?.title || "<no title>";
            console.log(`Error processing item id='${item.id}', title="${title}":`);
            console.log(`ERROR: "${err.message ?? err}"`);
        }
    }

    console.log(`\nALL FINISHED.`
        + ` countTotalItems='${countTotalItems}';`
        + ` countChangedItems='${countChangedItems}';`
        + ` countErrItems='${countErrItems}'.`);
}


// Top-scope main function invocation:
main().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});