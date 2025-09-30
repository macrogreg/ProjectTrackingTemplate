**Project Tracking Template v01** is a template for a simple engineering work tracking project that can span multiple repos. The project avoids the confusion and the clunkiness around GH Issues and Millstones and includes convenient estimation automations. 

# Key differentiators

## Avoid the clunkiness and the confusion around _Issues_ and Project _Work Items_

_Issues'_ primary purpose is (traditionally) to be a mechanism for interacting with the open source community and with a distributed Dev team.  
Moreover, _issues_ exist on a repository level.  

On contrary, project _work items'_ primary purpose is to plan and track tasks.  
_Work items_ exists on a project level and a single project may span several repositories.  
Project _work items_ are managed and controlled by project leads (or whoever is responsible for planning, scheduling, prioritization, etc.) with input from the Dev team. Specific _work items_ may or may not be linked to specific _issues_, but their respective purposes are very different.

To keep these concepts separate and to avoid confusion, this project uses only Non-Issue Work Items on its boards (GitHub confusingly calls them "draft items", although there is nothing "drafty" or "preliminary" about them).

## Avoid the clunkiness around _Milestones_ by using _Mileposts_

_Milestones_ exist on a repository level, while projects span multiple repositories. This creates clunkiness around using milestones for tracking delivery stages in multi-repo projects. To avoid this, we use a custom field called "_Milepost_".  
_Mileposts_ are named `01. Moniker A` ... `99. Moniker ZZ`.


# Estimation Strategy

Users estimate work items using two custom fields: 
 - `Size`: an estimated _range_ for time/effort required to complete a work item.
 - `Risk`: a level of confidence that the size estimation is correct.  

The auto-computed custom field `Days Estimate` is a _single number_ based on those inputs. It is used for planning how long multiple sequential work items will take.  
For that, `Days Estimate`-values of the respective work items are summed up.  The result represents the estimated number of **_working_ days** required to complete the work item(s), given the respective items' risk-confidence, and assuming **_full_ and _exclusive_ concentration** on that work.  

Details and guidance on performing estimations, and on computing and interpreting estimate values [can be found](https://github.com/macrogreg/ProjectTrackingTemplate/blob/master/README.md#estimating-work-items-and-computing-time-effort) in the below-mentioned repo.

### Auto-computing `Days Estimate`

Do _not_ manually edit the values in the `Days Estimate` field. They are _automatically_ computed as described here.

The script that automatically computes `Days Estimate` is located in the repo [macrogreg/ProjectTrackingTemplate](https://github.com/macrogreg/ProjectTrackingTemplate).  When you use this template to create a project, you need to clone that repo, point it to your new project, and respectively configure the security tokens for project access (detailed instructions in the repo).

The estimation update script is triggered by a GitHub workflow that runs every 20 minutes automatically (and can also be run manually as needed). The workflow is located in the same repo. 


# Custom Fields

## Team

The _engineering team_ and/or the _general product area_ to which a work item belongs.   

> Change/adjust the list of teams as needed after creating a new project based on this template. `X-Team` stands for cross-team.

Use for high-level planning: Loosely speaking, work items from different teams can be performed in parallel, while items from the same team need to be sequenced. (This is stark simplification; work across teams may still have sequential dependencies, and work within a team may still be possible to parallelize.)

Use in dashboard queries: Group or filter by `Team` to focus on work items related to a single engineering team or a general product area.

## Milepost

The earliest high-level project stage or release for which a work item is required.

Similar to the "milestone" (a built-in GitHub concept). `Milepost` is preferred over milestones, because milestones exist on a repository level, while project mileposts can span multiple repositories. Using milestones would create clunkiness and overhead in keeping milestones synchronized across repos, or when a repo is used by different projects with potentially different "stages". The additional milestone-related features (e.g. dates) are not required for nimble low-overhead planning style embraced by this project. 

_Milepost_ items are named like `NN. Xyz`.  
E.g.  `01. Moniker AA`, ..., `99. Moniker ZZ`.  
Use number prefixes for logical sorting and make sure to reserve free numbers to add milestones later. Reserve number ranges for "special" mileposts.

> Change/adjust the list of mileposts as needed after creating a new project based on this template.  

## Priority

The priority of completing a work item within the specified scope and timeline.

Use `P1` (must complete), `P2` (should complete), `P3` (nice to have).  
Never use `P0` for project planning. `P0` indicates unplanned "drop everything else" work, like severe operational issues or newly discovered security issues.

> You may change/adjust the list of possible priorities as needed after creating a new project based on this template, but it is recommended to keep the default option.

## Story-Group

A specific or set of features or a specific product area that groups related work items.  
A particular `Story-Group` may map to a specific high-level user-story, or it may describe a group of user-stories around the same product area.  
A `Story-Group` can include work items from different Teams or Mileposts.

> Change/adjust the list of mileposts as needed after creating a new project based on this template.  
> Large projects may have a large, steadily growing number of Story Groups. Curate as needed.

## Waiting on

Set to a non-empty value when an item's is `Status` is `In progress`, but actual progress towards completion cannot be made.  
The value of the `Blocked on` field describes what specifically prevents work towards item completion.  
Clear this field if an item becomes unlocked again.

> Change/adjust the list of `Waiting on`-values as needed after creating a new project based on this template, but keep their number low and keep things simple.

## Size

An estimated number of working days required to complete a work item.  
See "Estimation Strategy"-section in this doc.

> Do NOT change/adjust the list of possible `Size`-values after creating a new project based on this template. Automation depends on them.

## Risk

A level of confidence that the `Size`-estimation is correct.  
See "Estimation Strategy"-section in this doc.

> Do NOT change/adjust the list of possible `Risk`-values after creating a new project based on this template. Automation depends on them.

## Days Estimate

> The `Days Estimate`-value is auto-computed. Do NOT edit manually.

A single-number estimate for how many working days a work item will actually take to complete, based on specified `Size` and `Risk`.  
`Days Estimate` values for multiple for items are summed up for planning how many working days are required to sequentially complete those work items.  
See "Estimation Strategy"-section in this doc.

