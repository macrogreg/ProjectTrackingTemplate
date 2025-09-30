# ProjectTrackingTemplate

This repo contains the automations required for **project "[Project Tracking Template v01](https://github.com/users/macrogreg/projects/3?pane=info)"** and for other projects based on that template.  
It also contains a copy of the documentation.

When you use that template to create a new project, you must clone this repo, point it to your new target project using Env vars, and configure the security tokens for your new project access (instructions [below](#configuring-target-project-and-security-tokens)).

> #### Related resources
> * [Project Template: Main View (site)](/users/macrogreg/projects/3?pane=info)
> * [Project Template: Short Description (doc)](./ProjectTemplate.ShortDescription.md)
> * [Project Template: ReadMe (doc)](./ProjectTemplate.ReadMe.md)


# Included automations

### `/.github/workflows/update-project-item-estimation.yml`

Workflow to trigger the script that updates the estimates for time / effort required for completing work items.  
This workflow is automatically triggered at regular time intervals, and can also be manually started when needed.  

The workflow uses GH secrets and variables to access configure the environment for the script it triggers.  
Make sure to configure them accordingly if you close this repo.

### `/.github/scripts/update-project-item-estimation.js`

Script to automatically compute time / effort estimates for work items (see below for details).  
The project where the work items to be estimated3ed are located is passed by the invoking workflow via the environment.  


# Estimating work items and computing time effort

## TL;DR

Projects supported by `update-project-item-estimation.js`-script use two custom fields to describe the complexity of work items:
 - `Size`: an estimated _range_ for time/effort required to complete a work item.
 - `Risk`: a level of confidence that the size estimation is correct.  

The custom field `Days Estimate` is a _single number_ automatically computed based on those inputs. It is used for planning how long multiple sequential work items will take.  
For that, `Days Estimate`-values of the respective work items are summed up.  The result represents the estimated number of **_working_ days** required to complete the work item(s), given the respective items' risk-confidence, and assuming **_full_ and _exclusive_ concentration** on that work.  

See [Project Tracking Template v01](https://github.com/users/macrogreg/projects/3?pane=info) for additional info.


## Details

The `Days Estimate` field represents _working days_ required to complete the item with _full and exclusive concentration_.  
In most cases it is advantageous to define work items so that they are worked on by a single person. Work involving multiple people should be represented by multiple dependent or related work items.

`Days Estimate` is auto-computed based on the `Size` and the `Risk` fields:

| | | | | |
| :--- | :---: | :---: | :---: | :---: |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; /&nbsp;**`Risk`**<br/>**`Size`**<sub>(_Dm_ - _D_ days)</sub> | **`Low`**<br/>`well-understood`<br/><sub>(_Dm_ + _D_) / 2</sub> | **`Mid`**<br/>`some unknowns`<br/><sub>_D_</sub> | **`High`**<br/>`requires research`<br/><sub>_D_ × 1.5</sub> | **`Severe`**(__*__)<br/>`open-ended`<br/><sub>_D_ × 4</sub> |
| **`XS`** `(1 ≤ day)` | 0.5 | 1 | 1.5 | 4 |
| **`S`** `(1 - 3 days)` | 2 | 3 | 4.5 | 12 |
| **`M`** `(3 - 5 days)` | 4 | 5 | 7.5 | 20 | 
| **`L`** `(1 - 2 weeks)` | 7.5 | 10 | 15 | 40 |
| **`XL`**(__*__) `(2+ weeks)` | 15 | 20 | 30 | 80 |

(__*__) `XL`-sized items and `Severe`-risk-level items are typically not well-enough understood to be included into timeline estimates with any reasonable degree of reliability. Such items should ideally be split into more concrete items. If you really need to use such items, apply estimate figures that are _at least_ as large as stated in the table.

## Deeper details

**1.** The `size` field defines the _working_ days range estimate for the item:
    - the _base duration_ (_D_) is the upper end of the `size` field;
    - the _min duration_ (_Dm_) is the lower end of the `size` field.

| `Size` | _D_ <br/> (base duration in working days) | _Dm_ <br/> (min duration in working days) |
| :--- | :---: | :---: |
| `XS (1 ≤ day)` | 1 | 0.25
| `S (1 - 3 days)` | 3 | 1 |
| `M (3 - 5 days)` | 5 | 3 |
| `L (1 - 2 weeks)` | 10 | 5 |
| `XL (2+ weeks)` __*__ | 20 | 10 |

__*__ An `XL`-sized item indicates that it may be not well-enough understood to be included into timeline projections. Consider splitting it into smaller work items. If you really need to use `XL`-sized items, prefer using `High` or `Severe` risk levels to account for overlooked details.

**2.** Apply a _risk modifier_ based on the `Risk`-field to transform the _range_ estimated in step 1 into a single number representing an estimation for how many _working_ days will actually be needed to complete the item (round _up_ calculations to the nearest half-day):
* `Low: well-understood` => (_Dm_ + _D_) / 2
* `Mid: some unknowns` => _D_
* `High: requires research` => _D_ × 1.5
* `Severe: open-ended` => _D_ × 4  (__*__)

__*__ `Severe` risk-level indicates that the item is likely not well-enough understood to be included into timeline projections. Consider splitting such work into smaller, better understood work items. But if you really need to use `Severe`-risk work items, assume _D_ × 4 days (or more).


# Configuring Target Project and Security Tokens

If you used the [project template](https://github.com/users/macrogreg/projects/3?pane=info) to create a new project and cloned this repo to enable the automations in your new project, you need to target the clone to your new project, and configure the security tokens so that the clone can access its new target.

## Security token

### Creating the token

#### Projects owned by organizations
If you project belongs to an organization you must configure a _fine-grained_ personal access token (PAT). Fine-grained PATs are configured under:
 * `User` > `Settings` > `Developer Settings` > `Personal Access Tokens` > `Fine-grained tokens`  
   [https://github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)

Create a new file-grained PAT. Settings:  
_Token name_: a recommended pattern is `TOKEN_REPO_NAME_TARGET_PROJECT_RW`; e.g., the token for the upstream repo is called `TOKEN_PROJECT_TRACKING_TEMPLATE_TARGET_PROJECT_RW`, however, you can use any name you like.  
_Resource owner_: The organization that owns the project.  
_Repository access_: irrelevant since projects exist outside repos.
_Permissions_: select `Projects` with _access_ set to `Read and write`.

**(!)** Once created, remember to write down the token value in a secure location. Once you navigate away form that screen, the value can no longer be retrieved.

#### Projects owned by individual users
If you project belongs to a you must configure a _classic_ personal access token (PAT). Classic PATs are configured under:
 * `User` > `Settings` > `Developer Settings` > `Personal Access Tokens` > `Tokens (classic)`  
   [https://github.com/settings/tokens](https://github.com/settings/tokens)

Create a new classic PAT. Settings:  
_Token name_: a recommended pattern is `TOKEN_REPO_NAME_TARGET_PROJECT_RW`; e.g., the token for the upstream repo is called `TOKEN_PROJECT_TRACKING_TEMPLATE_TARGET_PROJECT_RW`, however, you can use any name you like.
_Scopes_: select `projects` with _full control_ access.

**(!)** Once created, remember to write down the token value in a secure location. Once you navigate away form that screen, the value can no longer be retrieved.

### Storing the token as a secure secret

The token belongs to a user and grants access either to projects within a specific organization or to all projects accessible to the user (see above). However, its value will be used by scripts in a repo. Next, you need to configure it for access to such scripts as a secure secret.

Secrets are configured under:
* `Repo` > `Settings` > `Secrets and variables` > `Actions`  
  URL: `https://github.com/`_`repo_owner_org_or_user`_`/`_`repo_name`_`/settings/secrets/actions`  
  Tab: `Secrets`

Tap '_New repository secret_'. Use the name `TOKEN_TARGET_PROJECT_RW`. You can use any other valid name, but you will need to adjust the secret reference in the workflow to match it.  
Enter the exact value of the token you created earlier into the _Secret_ field.

Remember to rotate the token and to update the secret value once the token expirtion date is reached.

## Configuration variables

There are some additional non-secret variables that need to be configured under:

Secrets are configured under:
* `Repo` > `Settings` > `Secrets and variables` > `Actions`  
  URL: `https://github.com/`_`repo_owner_org_or_user`_`/`_`repo_name`_`/settings/secrets/actions`  
  Tab: `Variables`

Tap '_New repository variable_'. to create a new clear-text variable. The following is required:
  - `VAR_TARGET_PROJECT_OWNER_TYPE`: Either `organization` or `user`, depending on what type of entity owns the target project.
  - `VAR_TARGET_PROJECT_OWNER_NAME`: A string denoting the name of the organization or the GitHub user who owns the target project.
 - `VAR_TARGET_PROJECT_NUMBER_ID`: An integer denoting the project number within its owner container.  
 When you open the project in the browser, the URL looks like:  
 `https://github.com/`_`repo_owner_org_or_user`_`/projects/`_**`N`**_`/`  
 There, '_**`N`**_' is the project number.
