const axios = require('axios');

const TOKEN_PROJECT_ACCESS_RW = process.env.TOKEN_PROJECT_ACCESS_RW;

const VAR_ESTIMATE_TARGET_PROJECT_ID = process.env.VAR_ESTIMATE_TARGET_PROJECT_ID;
const VAR_ESTIMATE_TARGET_OWNER_TYPE = process.env.VAR_ESTIMATE_TARGET_OWNER_TYPE;
const VAR_ESTIMATE_TARGET_OWNER_NAME = process.env.VAR_ESTIMATE_TARGET_OWNER_NAME;

if (!TOKEN_PROJECT_ACCESS_RW) {
    throw new Error("`TOKEN_PROJECT_ACCESS_RW` is missing.");
}

if (!VAR_ESTIMATE_TARGET_OWNER_TYPE) {
    throw new Error("`VAR_ESTIMATE_TARGET_OWNER_TYPE` is missing.");
} else {
    if (typeof VAR_ESTIMATE_TARGET_OWNER_TYPE !== "string") {
        throw new Error("`VAR_ESTIMATE_TARGET_OWNER_TYPE` is not a string.");
    }

    let ownerTypeLower = VAR_ESTIMATE_TARGET_OWNER_TYPE.toLowerCase();
    if (ownerTypeLower !== "organization"
            && ownerTypeLower !== "user") {
        throw new Error(
            "`VAR_ESTIMATE_TARGET_OWNER_TYPE` is '" + VAR_ESTIMATE_TARGET_OWNER_TYPE
            + "', but one of the following was expected: ['organization', 'user'].");
    }
}

if (!VAR_ESTIMATE_TARGET_OWNER_NAME) {
    throw new Error("`VAR_ESTIMATE_TARGET_OWNER_NAME` is missing.");
}

if (!VAR_ESTIMATE_TARGET_PROJECT_ID) {
    throw new Error("`VAR_ESTIMATE_TARGET_PROJECT_ID` is missing.");
}


function EstimatedCostTableRow(low, mid, high, severe) {
    return {
        ["LOW"]: low,
        ["MID"]: mid, 
        ["HIGH"]: high,
        ["SEVERE"]: severe
    };
}


function computeEstimatedCost(size, risk) {

    const EstimatedCostInDays = {
        ["XS"]: EstimatedCostTableRow(  0.5,   1,   1.5,   4),
        ["S"]:  EstimatedCostTableRow(  2,     3,   4.5,  12),
        ["M"]:  EstimatedCostTableRow(  4,     5,   7.5,  20),
        ["L"]:  EstimatedCostTableRow(  7.5,  10,  15,    40),
        ["XL"]: EstimatedCostTableRow( 15,    20,  30,    80),
    };

    const sizeKey = size?.split('(')[0].trim().toUpperCase();
    const riskKey = risk?.split(':')[0].trim().toUpperCase();

    if (!(sizeKey in EstimatedCostInDays)) {
        const errMsg = `Invalid Size specifier: original value: "${size}"; key: "${sizeKey}".`;
        console.log(errMsg);
        throw new Error(errMsg);
    }

    const costTableRow = EstimatedCostInDays[sizeKey];

    if (!(riskKey in costTableRow)) {
        const errMsg = `Invalid Risk specifier: original value: "${risk}"; key: "${riskKey}".`;
        console.log(errMsg);
        throw new Error(errMsg);
    }

    const estimate = costTableRow[riskKey];
    // console.log(`EstimatedCostInDays[${sizeKey}][${riskKey}]: '${estimate}'`);
    return estimate;
}


async function graphql(query, variables = {}) {

    console.log("VARS:");
    console.log(JSON.stringify(variables));

    const res = await axios.post(
        'https://api.github.com/graphql',
        { query, variables },
        {
            headers: {
                Authorization: `Bearer ${TOKEN_PROJECT_ACCESS_RW}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (res.data.errors) {
        console.error("GraphQL call resulted in error.");

        const errInfo = JSON.stringify(res.data.errors, null, 2)
        console.error(errInfo);

        throw new Error("GraphQL error: " + errInfo);
    }

    return res.data;
};


async function getFieldIds() {

    const ownerType = VAR_ESTIMATE_TARGET_OWNER_TYPE.toLowerCase();

    const query = `
        query($owner: String!, $projectNumber: Int!) {
            `+ownerType+`(login: $owner) {
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

    const projectNumber = parseInt(VAR_ESTIMATE_TARGET_PROJECT_ID, 10);

    console.log("\n===========-===========-===========-===========-===========");
    console.log("Getting GraphQL IDs:");
    console.log("    Target project owner type: '" + ownerType + "'.");
    console.log("    Target project owner name: '" + VAR_ESTIMATE_TARGET_OWNER_NAME + "'.");
    console.log("    Target project number: " + projectNumber + ".");

    const data = await graphql(
        query,
        {
            owner: VAR_ESTIMATE_TARGET_OWNER_NAME,
            projectNumber
        }
    );

    const fields = data.data.organization.projectV2.fields.nodes;

    const getFieldIdByName = (name) => {
        const field = fields.find(f => f.name.toLowerCase() === name.toLowerCase());
        if (!field) throw new Error(`Field "${name}" not found`);
        return field.id;
    };

    return {
        estimationHackFieldId: getFieldIdByName("Estimation Hack"),
        projectId: data.data.organization.projectV2.id
    };
}


async function getProjectItems(projectId) {
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

        const data = await graphql(query, variables);
        const page = data.data.node.items;

        items.push(...page.nodes);
        hasNextPage = page.pageInfo.hasNextPage;
        cursor = page.pageInfo.endCursor;
    }

    return items;
}


async function updateEstimationHack(projectId, itemId, fieldId, value) {
    const mutation = `
        mutation($input: UpdateProjectV2ItemFieldValueInput!) {
            updateProjectV2ItemFieldValue(input: $input) {
                projectV2Item {
                    id
                }
            }
        }
    `;

    await graphql(mutation, {
        input: {
            projectId,
            itemId,
            fieldId,
            value: {
                number: value
            }
        }
    });
}


async function main() {
    const { estimationHackFieldId, projectId } = await getFieldIds();

    const items = await getProjectItems(projectId);

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

            const estimate = computeEstimatedCost(size, risk);
            console.log(`Computed Estimate = '${estimate ?? "<not available>"}'.`);

            const existingEstimate = fields.find(f => f.field?.name.toLowerCase() === "estimation hack")?.number;
            console.log(`Exiting Estimate  = '${existingEstimate ?? "<not available>"}'.`);

            const isUpdateNeeded = (existingEstimate !== estimate);
            console.log(`Is Update Needed  = '${isUpdateNeeded}'.`);

            if (!isUpdateNeeded) {
                console.log("Skipping update.");
                continue;
            }

            await updateEstimationHack(projectId, item.id, estimationHackFieldId, estimate);
            countChangedItems++;

            console.log(`Item #${countTotalItems} updated. This was update #${countChangedItems}.`);
            
        } catch(err) {
            countErrItems++;
            console.log(`Error processing item id='${item.id}', title="${title}":`);
            console.log(`ERROR: "${err.message ?? err}"`);
        }
    }

    console.log(`\nALL FINISHED.`
        + ` countTotalItems='${countTotalItems}';`
        + ` countChangedItems='${countChangedItems}';`
        + ` countErrItems='${countErrItems}'.`);
}


main().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});