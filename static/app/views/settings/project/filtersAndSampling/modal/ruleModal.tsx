import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CompactSelect from 'sentry/components/forms/compactSelect';
import NumberField from 'sentry/components/forms/numberField';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, SelectValue} from 'sentry/types';
import {
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRules,
} from 'sentry/types/dynamicSampling';
import {defined} from 'sentry/utils';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import Conditions from './conditions';
import {getErrorMessage, isLegacyBrowser} from './utils';

type ConditionsProps = React.ComponentProps<typeof Conditions>['conditions'];

type State = {
  conditions: ConditionsProps;
  errors: {
    sampleRate?: string;
  };
  sampleRate: number | null;
};

type Props = ModalRenderProps & {
  api: Client;
  conditionCategories: Array<[DynamicSamplingInnerName, string]>;
  emptyMessage: string;
  onSubmit: (
    props: Omit<State, 'errors'> & {
      submitRules: (
        newRules: DynamicSamplingRules,
        currentRuleIndex: number
      ) => Promise<void>;
    }
  ) => void;
  onSubmitSuccess: (project: Project, successMessage: React.ReactNode) => void;
  organization: Organization;
  project: Project;
  title: string;
  extraFields?: React.ReactElement;
  onChange?: (props: State) => void;
  rule?: DynamicSamplingRule;
};

function RuleModal({
  Header,
  Body,
  Footer,
  closeModal,
  title,
  emptyMessage,
  conditionCategories,
  api,
  organization,
  project,
  onSubmitSuccess,
  onSubmit,
  onChange,
  extraFields,
  rule,
}: Props) {
  const [data, setData] = useState<State>(getInitialState());

  useEffect(() => {
    if (!!data.errors.sampleRate) {
      setData({...data, errors: {...data.errors, sampleRate: undefined}});
    }
  }, [data.sampleRate]);

  useEffect(() => {
    onChange?.(data);
  }, [data]);

  function getInitialState(): State {
    if (rule) {
      const {condition: conditions, sampleRate} = rule as DynamicSamplingRule;

      const {inner} = conditions;

      return {
        conditions: inner.map(({name, value}) => {
          if (Array.isArray(value)) {
            if (isLegacyBrowser(value)) {
              return {
                category: name,
                legacyBrowsers: value,
              };
            }
            return {
              category: name,
              match: value.join('\n'),
            };
          }
          return {category: name};
        }),
        sampleRate: sampleRate * 100,
        errors: {},
      };
    }

    return {
      conditions: [],
      sampleRate: null,
      errors: {},
    };
  }

  const {errors, conditions, sampleRate} = data;

  async function submitRules(newRules: DynamicSamplingRules, currentRuleIndex: number) {
    try {
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      onSubmitSuccess(
        newProjectDetails,
        rule
          ? t('Successfully edited dynamic sampling rule')
          : t('Successfully added dynamic sampling rule')
      );
      closeModal();
    } catch (error) {
      convertRequestErrorResponse(getErrorMessage(error, currentRuleIndex));
    }
  }

  function convertRequestErrorResponse(error: ReturnType<typeof getErrorMessage>) {
    if (typeof error === 'string') {
      addErrorMessage(error);
      return;
    }

    switch (error.type) {
      case 'sampleRate':
        setData({...data, errors: {...errors, sampleRate: error.message}});
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  function handleAddCondition(selectedOptions: SelectValue<DynamicSamplingInnerName>[]) {
    const previousCategories = conditions.map(({category}) => category);
    const addedCategories = selectedOptions
      .filter(({value}) => !previousCategories.includes(value))
      .map(({value}) => value);
    setData({
      ...data,
      conditions: [
        ...conditions,
        ...addedCategories.map(addedCategory => ({category: addedCategory, match: ''})),
      ],
    });
  }

  function handleDeleteCondition(index: number) {
    const newConditions = [...conditions];
    newConditions.splice(index, 1);
    setData({...data, conditions: newConditions});
  }

  function handleChangeCondition<T extends keyof ConditionsProps[0]>(
    index: number,
    field: T,
    value: ConditionsProps[0][T]
  ) {
    const newConditions = [...conditions];
    newConditions[index][field] = value;
    setData({...data, conditions: newConditions});
  }

  const submitDisabled =
    !defined(sampleRate) ||
    !!conditions?.find(condition => {
      if (condition.category === DynamicSamplingInnerName.EVENT_LEGACY_BROWSER) {
        return !(condition.legacyBrowsers ?? []).length;
      }

      if (
        condition.category === DynamicSamplingInnerName.EVENT_LOCALHOST ||
        condition.category === DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS ||
        condition.category === DynamicSamplingInnerName.EVENT_WEB_CRAWLERS
      ) {
        return false;
      }

      return !condition.match;
    });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{title}</h4>
      </Header>
      <Body>
        <Fields>
          {extraFields}
          <StyledPanel>
            <StyledPanelHeader hasButtons>
              {t('Conditions')}
              <StyledCompactSelect
                placement="bottom right"
                triggerLabel={t('Add Condition')}
                placeholder={t('Filter conditions')}
                isOptionDisabled={opt => opt.disabled}
                options={conditionCategories.map(([value, label]) => {
                  const disabled = conditions.some(
                    condition => condition.category === value
                  );
                  return {
                    value,
                    label,
                    disabled,
                    tooltip: disabled
                      ? t('This condition has already been added')
                      : undefined,
                  };
                })}
                value={conditions.map(({category}) => category)}
                onChange={handleAddCondition}
                isSearchable
                multiple
              />
            </StyledPanelHeader>
            <PanelBody>
              {!conditions.length ? (
                <EmptyMessage icon={<IconCheckmark isCircled size="xl" />}>
                  {emptyMessage}
                </EmptyMessage>
              ) : (
                <Conditions
                  conditions={conditions}
                  onDelete={handleDeleteCondition}
                  onChange={handleChangeCondition}
                  orgSlug={organization.slug}
                  projectId={project.id}
                />
              )}
            </PanelBody>
          </StyledPanel>
          <NumberField
            label={`${t('Sampling Rate')} \u0025`}
            name="sampleRate"
            onChange={value => {
              setData({...data, sampleRate: !!value ? Number(value) : null});
            }}
            placeholder={'\u0025'}
            value={sampleRate}
            inline={false}
            hideControlState={!errors.sampleRate}
            error={errors.sampleRate}
            showHelpInTooltip
            stacked
            required
          />
        </Fields>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={() => onSubmit({conditions, sampleRate, submitRules})}
            title={submitDisabled ? t('Required fields must be filled out') : undefined}
            disabled={submitDisabled}
          >
            {t('Save Rule')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default RuleModal;

const Fields = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const StyledCompactSelect = styled(CompactSelect)`
  font-weight: 400;
  text-transform: none;
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-right: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;
