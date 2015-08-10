from contentbase.attachment import ItemWithAttachment
from contentbase.schema_utils import (
    load_schema,
)
from contentbase import (
    calculated_property,
    collection,
)
from pyramid.traversal import find_root
from .base import (
    Item,
    paths_filtered_by_status,
)


def includeme(config):
    config.scan()

### new collections added for handling curation data, 06/19/2015
@collection(
    name='genes',
    unique_key='gene:symbol',
    properties={
        'title': 'HGNC Genes',
        'description': 'List of genes',
    })
class Gene(Item):
    item_type = 'gene'
    schema = load_schema('clincoded:schemas/gene.json')
    name_key = 'symbol'

@collection(
    name='diseases',
    unique_key='orphaPhenotype:orphaNumber',
    properties={
        'title': 'Orphanet Diseases',
        'description': 'List of Orphanet diseases (phenotypes)',
    })
class OrphaPhenotype(Item):
    item_type = 'orphaPhenotype'
    schema = load_schema('clincoded:schemas/orphaPhenotype.json')
    name_key = 'orphaNumber'

'''
@collection(
    name='diseases',
    unique_key='orphaPhenotype:uuid',
    properties={
        'title': 'diseases',
        'description': 'List of all diseases',
    })
class Disease(Item):
    item_type = 'disease'
    schema = load_schema('clincoded:schemas/disease.json')
    name_key = 'uuid'

@collection(
    name='statistics',
    unique_key='statistic:uuid',
    properties={
        'title': 'Statistical Study',
        'description': 'List of statistical studies in all gdm pairs',
    })
class Statistic(Item):
    item_type = 'statistic'
    schema = load_schema('clincoded:schemas/statistic.json')
    name_key = 'uuid'
    embedded = [
        'variants',
        'assessments'
    ]

@collection(
    name='controlgroups',
    unique_key='controlGroup:uuid',
    properties={
        'title': 'Control Groups',
        'description': 'List of control groups in all gdm pairs',
    })
class ControlGroup(Item):
    item_type = 'controlGroup'
    schema = load_schema('clincoded:schemas/controlGroup.json')
    name_key = 'uuid'
'''

@collection(
    name='articles',
    unique_key='article:pmid',
    properties={
        'title': 'References',
        'description': 'List of PubMed references stored locally',
    })
class Article(Item):
    item_type = 'article'
    schema = load_schema('clincoded:schemas/article.json')
    name_key = 'pmid'

@collection(
    name='variants',
    unique_key='variant:uuid',
    properties={
        'title': 'Variants',
        'description': 'List of variants stored locally',
    })
class Variant(Item):
    item_type = 'variant'
    schema = load_schema('clincoded:schemas/variant.json')
    name_key = 'uuid'

@collection(
    name='gdm',
    unique_key='gdm:uuid',
    properties={
        'title': 'Gene:Disease:Mode',
        'description': 'List of Gene:Disease:Mode pairs',
    })
class Gdm(Item):
    item_type = 'gdm'
    schema = load_schema('clincoded:schemas/gdm.json')
    name_key = 'uuid'
    embedded = [
        'gene',
        'disease',
        'annotations',
        'annotations.article',
        'annotations.groups',
        'annotations.groups.commonDiagnosis',
        'annotations.groups.otherGenes',
        'annotations.groups.method',
        #'annotations.groups.statistic',
        #'annotations.groups.statistic.variants',
        #'annotations.groups.statistic.assessments',
        'annotations.groups.familyIncluded',
        'annotations.groups.familyIncluded.commonDiagnosis',
        'annotations.groups.familyIncluded.method',
        #'annotations.groups.familyIncluded.variants',
        'annotations.groups.familyIncluded.segregation.variants',
        'annotations.groups.familyIncluded.segregation.assessments',
        'annotations.groups.familyIncluded.individualIncluded',
        'annotations.groups.familyIncluded.individualIncluded.diagnosis',
        'annotations.groups.familyIncluded.individualIncluded.method',
        'annotations.groups.familyIncluded.individualIncluded.variants',
        'annotations.groups.individualIncluded',
        'annotations.groups.individualIncluded.diagnosis',
        'annotations.groups.individualIncluded.method',
        'annotations.groups.individualIncluded.variants',
        #'annotations.groups.control',
        'annotations.families',
        'annotations.families.commonDiagnosis',
        'annotations.families.method',
        #'annotations.families.variants',
        'annotations.families.segregation.variants',
        'annotations.families.segregation.assessments',
        'annotations.families.individualIncluded',
        'annotations.families.individualIncluded.diagnosis',
        'annotations.families.individualIncluded.method',
        'annotations.families.individualIncluded.variants',
        'annotations.individuals',
        'annotations.individuals.diagnosis',
        'annotations.individuals.method',
        'annotations.individuals.variants',
        'annotations.experimentalData',
        'annotations.experimentalData.variants',
        'annotations.experimentalData.biochemicalFunction.geneWithSameFunctionSameDisease.assessments',
        'annotations.experimentalData.biochemicalFunction.geneWithSameFunctionSameDisease.genes',
        'annotations.experimentalData.biochemicalFunction.geneFunctionConsistentWithPhenotype.assessments',
        'annotations.experimentalData.expression.alteredExpression.assessments',
        'annotations.experimentalData.expression.normalExpression.assessments',
        'annotations.experimentalData.proteinIneractions.interactingGenes',
        'annotations.experimentalData.proteinIneractions.assessments',
        'annotations.experimentalData.functionalAleration.assessments',
        'annotations.experimentalData.modelSystems.assessments',
        'annotations.experimentalData.rescue.assessments',
        'variantPathogenic.variant',
        'variantPathogenic.assessments'
    ]

    @calculated_property(schema={
        "title": "Status",
        "type": "string",
    })
    def status(self, finalClassification, draftClassification, provisionalClassifications, annotations):
        if finalClassification != '':
            return 'Final Classification'
        elif draftClassification != '':
            return 'Draft Classification'
        elif len(provisionalClassifications) > 0:
            return 'Summary/Provisional Classifications'
        elif len(annotations) > 0:
            return 'In Progress'
        else:
            return 'Created'

@collection(
    name='evidence',
    unique_key='annotation:uuid',
    properties={
        'title': 'Evidence',
        'description': 'List of evidence for all G:D:M pairs',
    })
class Annotation(Item):
    item_type = 'annotation'
    schema = load_schema('clincoded:schemas/annotation.json')
    name_key = 'uuid'
    embedded = [
        'article',
        'groups',
        'groups.commonDiagnosis',
        'groups.otherGenes',
        'groups.method',
        #'groups.statistic',
        #'groups.statistic.variants',
        #'groups.statistic.assessments',
        'groups.familyIncluded.commonDiagnosis',
        'groups.familyIncluded.method',
        #'groups.familyIncluded.variants',
        'groups.familyIncluded.segregation.variants',
        'groups.familyIncluded.segregation.assessments',
        'groups.familyIncluded.individualIncluded',
        'groups.familyIncluded.individualIncluded.diagnosis',
        'groups.familyIncluded.individualIncluded.method',
        'groups.familyIncluded.individualIncluded.variants',
        'groups.individualIncluded',
        'groups.individualIncluded.diagnosis',
        'groups.individualIncluded.method',
        'groups.individualIncluded.variants',
        #'groups.control',
        'families',
        'families.commonDiagnosis',
        'families.method',
        #'families.variants',
        'families.segregation.variants',
        'families.segregation.assessments',
        'families.individualIncluded',
        'families.individualIncluded.diagnosis',
        'families.individualIncluded.method',
        'families.individualIncluded.variants',
        'individuals',
        'individuals.diagnosis',
        'individuals.method',
        'individuals.variants',
        'experimentalData',
        'experimentalData.variants',
        'experimentalData.biochemicalFunction.geneWithSameFunctionSameDisease.assessments',
        'experimentalData.biochemicalFunction.geneWithSameFunctionSameDisease.genes',
        'experimentalData.biochemicalFunction.geneFunctionConsistentWithPhenotype.assessments',
        'experimentalData.expression.alteredExpression.assessments',
        'experimentalData.expression.normalExpression.assessments',
        'experimentalData.proteinIneractions.interactingGenes',
        'experimentalData.proteinIneractions.assessments',
        'experimentalData.functionalAleration.assessments',
        'experimentalData.modelSystems.assessments',
        'experimentalData.rescue.assessments'
    ]

@collection(
    name='groups',
    unique_key='group:uuid',
    properties={
        'title': 'Groups',
        'description': 'List of groups in all gdm pairs',
    })
class Group(Item):
    item_type = 'group'
    schema = load_schema('clincoded:schemas/group.json')
    name_key = 'uuid'
    embedded = [
        'commonDiagnosis',
        'otherGenes',
        'method',
        #'statistic',
        #'statistic.variants',
        #'statistic.assessments',
        'familyIncluded',
        'familyIncluded.commonDiagnosis',
        'familyIncluded.method',
        #'familyIncluded.variants',
        'familyIncluded.segregation.variants',
        'familyIncluded.segregation.assessments',
        'familyIncluded.individualIncluded',
        'familyIncluded.individualIncluded.diagnosis',
        'familyIncluded.individualIncluded.method',
        'familyIncluded.individualIncluded.variants',
        'individualIncluded',
        'individualIncluded.diagnosis',
        'individualIncluded.method',
        'individualIncluded.variants',
        'otherPMIDs',
        #'control'
    ]

@collection(
    name='families',
    unique_key='family:uuid',
    properties={
        'title': 'Families',
        'description': 'List of families in all gdm pairs',
    })
class Family(Item):
    item_type = 'family'
    schema = load_schema('clincoded:schemas/family.json')
    name_key = 'uuid'
    embedded = [
        'commonDiagnosis',
        'method',
        'segregation.variants',
        'segregation.assessments',
        #'variants',
        'individualIncluded',
        'individualIncluded.diagnosis',
        'individualIncluded.method',
        'individualIncluded.variants'
    ]

@collection(
    name='individuals',
    unique_key='individual:uuid',
    properties={
        'title': 'Individuals',
        'description': 'List of individuals in gdm pair',
    })
class Individual(Item):
    item_type = 'individual'
    schema = load_schema('clincoded:schemas/individual.json')
    name_key = 'uuid'
    embedded = [
        'diagnosis',
        'method',
        'variants'
    ]

@collection(
    name='methods',
    unique_key='method:uuid',
    properties={
        'title': 'Methods',
        'description': 'List of methods in all groups, families and individuals',
    })
class Method(Item):
    item_type = 'method'
    schema = load_schema('clincoded:schemas/method.json')
    name_key = 'uuid'

@collection(
    name='assessments',
    unique_key='assessment:uuid',
    properties={
        'title': 'Assessments',
        'description': 'List of assessments to all studies',
    })
class Assessment(Item):
    item_type = 'assessment'
    schema = load_schema('clincoded:schemas/assessment.json')
    name_key = 'uuid'

@collection(
    name='experimental',
    unique_key='experimental:uuid',
    properties={
        'title': 'Experimental Studies',
        'description': 'List of all experimental studies',
    })
class Experimental(Item):
    item_type = 'experimental'
    schema = load_schema('clincoded:schemas/experimental.json')
    name_key = 'uuid'
    embedded = [
        'variants',
        'biochemicalFunction.geneWithSameFunctionSameDisease.assessments',
        'biochemicalFunction.geneWithSameFunctionSameDisease.genes',
        'biochemicalFunction.geneFunctionConsistentWithPhenotype.assessments',
        'expression.alteredExpression.assessments',
        'expression.normalExpression.assessments',
        'proteinIneractions.interactingGenes',
        'proteinIneractions.assessments',
        'functionalAleration.assessments',
        'modelSystems.assessments',
        'rescue.assessments'
    ]
### end of new collections for curation data


@collection(
    name='labs',
    unique_key='lab:name',
    properties={
        'title': 'Labs',
        'description': 'Listing of ENCODE DCC labs',
    })
class Lab(Item):
    item_type = 'lab'
    schema = load_schema('clincoded:schemas/lab.json')
    name_key = 'name'
    embedded = ['awards']


@collection(
    name='awards',
    unique_key='award:name',
    properties={
        'title': 'Awards (Grants)',
        'description': 'Listing of awards (aka grants)',
    })
class Award(Item):
    item_type = 'award'
    schema = load_schema('clincoded:schemas/award.json')
    name_key = 'name'


@collection(
    name='organisms',
    unique_key='organism:name',
    properties={
        'title': 'Organisms',
        'description': 'Listing of all registered organisms',
    })
class Organism(Item):
    item_type = 'organism'
    schema = load_schema('clincoded:schemas/organism.json')
    name_key = 'name'


@collection(
    name='sources',
    unique_key='source:name',
    properties={
        'title': 'Sources',
        'description': 'Listing of sources and vendors for ENCODE material',
    })
class Source(Item):
    item_type = 'source'
    schema = load_schema('clincoded:schemas/source.json')
    name_key = 'name'


@collection(
    name='documents',
    properties={
        'title': 'Documents',
        'description': 'Listing of Biosample Documents',
    })
class Document(ItemWithAttachment, Item):
    item_type = 'document'
    schema = load_schema('clincoded:schemas/document.json')
    embedded = ['lab', 'award', 'submitted_by']