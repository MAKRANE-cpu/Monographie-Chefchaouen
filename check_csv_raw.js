const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWWVTXdCJPajKKheU3te60ZfgVu8fiAa4JvAUQkwpCH23DhKUAbMlB71m9oX_YDA/pub?single=true&output=csv&gid=1244386954';

fetch(url)
    .then(res => res.text())
    .then(text => {
        console.log("--- START CSV ---");
        console.log(text.split('\n').slice(0, 5).join('\n'));
        console.log("--- END CSV ---");
    })
    .catch(err => console.error(err));
