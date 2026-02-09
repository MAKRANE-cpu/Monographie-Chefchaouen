const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWWVTXdCJPajKKheU3te60ZfgVu8fiAa4JvAUQkwpCH23DhKUAbMlB71m9oX_YDA/pub?single=true&output=csv&gid=144848058';

fetch(url)
    .then(res => res.text())
    .then(text => {
        console.log("--- ABATTOIRS CSV ---");
        console.log(text.split('\n').slice(0, 10).join('\n'));
        console.log("--- END ---");
    })
    .catch(err => console.error(err));
