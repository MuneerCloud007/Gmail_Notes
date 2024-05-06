'''
    Before use, you should download a service account JSON keyfile
    and point to it using an environment variable:
    $ export GOOGLE_APPLICATION_CREDENTIALS="/path/to/keyfile.json"
    for example:
    export GOOGLE_APPLICATION_CREDENTIALS="./simple_gmail_notes.json"
    use example:
    python store_translated_text.py
'''


import json
import os
from collections import OrderedDict
from google.cloud import translate


LANGUAGES = OrderedDict([
    ('am', 'Amharic'), ('ar', 'Arabic'), ('bn', 'Bangla'),
    ('bg', 'Bulgarian'), ('ca', 'Catalan'), ('zh_CN', 'Chinese (China)'),
    ('zh_TW', 'Chinese (Taiwan)'), ('hr', 'Croatian'), ('cs', 'Czech'),
    ('da', 'Danish'), ('nl', 'Dutch'), ('en', 'English (default)'),
    ('et', 'Estonian'), ('fil', 'Filipino'), ('fi', 'Finnish'),
    ('fr', 'French'), ('de', 'German'), ('el', 'Greek'),
    ('gu', 'Gujarati'), ('hi', 'Hindi'), ('hu', 'Hungarian'),
    ('id', 'Indonesian'), ('it', 'Italian'), ('ja', 'Japanese'),
    ('kn', 'Kannada'), ('ko', 'Korean'), ('lv', 'Latvian'),
    ('lt', 'Lithuanian'), ('ms', 'Malay'), ('ml', 'Malayalam'),
    ('mr', 'Marathi'), ('no', 'Norwegian'), ('fa', 'Persian'),
    ('pl', 'Polish'), ('ro', 'Romanian'), ('ru', 'Russian'),
    ('sr', 'Serbian'), ('sk', 'Slovak'), ('sl', 'Slovenian'),
    ('es', 'Spanish'), ('sw', 'Swahili'), ('sv', 'Swedish'),
    ('ta', 'Tamil'), ('te', 'Telugu'), ('th', 'Thai'),
    ('tr', 'Turkish'), ('uk', 'Ukrainian'), ('vi', 'Vietnamese')])


def get_source_text():
    '''get the source text'''
    source_text = []
    with open('description.txt', 'r') as description_file:
        source_description = description_file.read()
    with open('detailed_description.txt', 'r') as detailed_description_file:
        source_detailed_description = detailed_description_file.read().\
            replace('\n', '<span class="notranslate">\n</span>')
    source_text.append(source_description)
    source_text.append(source_detailed_description)
    return source_text


def get_translate_result(source_text, to_language):
    '''get the translated text'''
    translate_client = translate.Client()
    translate_result = translate_client.translate(
        source_text, target_language=to_language)
    return translate_result


def store_translated_result():
    '''store the translated result'''
    source_text = get_source_text()
    description = {'extDescription': {}}
    detailed_description = ''
    for language in LANGUAGES.keys():
        if not os.path.exists(language):
            os.makedirs(language)

        translate_result = get_translate_result(source_text, language)
        description['extDescription']['message'] =\
            translate_result[0]['translatedText']
        description['extDescription']['description'] =\
            'The description of the application, displayed in the web store.'
        detailed_description += LANGUAGES[language] + '\n' +\
            translate_result[1]['translatedText'].replace(\
            '<span class="notranslate">\n</span>', '\n').replace('\n ', '\n') +\
            '------------------------------------------------------------' +\
            '--------------------\n'
        final_description = json.dumps(\
            description, sort_keys=True, indent=4, ensure_ascii=False)

        #store description of the different languages in the json files
        with open('%s/messages.json' % language, 'w') as json_file:
            json_file.write(final_description.encode('utf-8'))

    # store detailed description of the different languages in a json file
    with open('detailed_description_result.txt', 'w') as result_file:
        result_file.write(detailed_description.encode('utf-8'))


def main():
    '''store the translated text'''
    store_translated_result()


if __name__ == '__main__':
    main()
