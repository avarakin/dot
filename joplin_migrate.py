from trilium_py.client import ETAPI

server_url = 'http://localhost:8080'
token = 's4gcnAbMjYNI_k0RSh/GIjnFlstobSj+fTpL5sRzUdOn3Ji2n3ypCWrA='
ea = ETAPI(server_url, token)

res = ea.upload_md_folder(
    parentNoteId="root",
    mdFolder="/home/alex/Dropbox/Apps/Joplin/",
    ignoreFolder=['.resource', 'lock', '.sync', 'temp'],

)