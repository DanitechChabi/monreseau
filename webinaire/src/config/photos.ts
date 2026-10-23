/**
 * Photographies réelles (Wikimedia Commons, licences CC BY-SA).
 * Fichiers recadrés / redimensionnés en WebP : les versions adaptées restent
 * sous la même licence. Le crédit est affiché sur chaque photo et repris sur
 * /confidentialite#credits.
 */
export const PHOTOS = {
  "toronto-rayonnages": {
    width: 1920,
    height: 1669,
    alt: "Allée d'un magasin d'archives, rayonnages chargés de boîtes de conservation.",
    caption: "Magasin des archives de la ville de Toronto (Canada)",
    author: "Sven Krüger",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/deed.fr",
    source: "https://commons.wikimedia.org/wiki/File:Standregale_im_Stadtarchiv_von_Toronto,_Canada.jpg",
  },
  "arewa-magasin": {
    width: 1920,
    height: 2879,
    alt: "Rayonnages remplis de liasses de documents ficelées et de cartons.",
    caption: "Magasin d'archives, Arewa House, Kaduna (Nigeria)",
    author: "Inyor4mr",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr",
    source: "https://commons.wikimedia.org/wiki/File:Storage_unit_of_Arewa_House_Archive.jpg",
  },
  "boites-archives": {
    width: 1920,
    height: 2560,
    alt: "Boîtes d'archives numérotées et étiquetées, alignées sur des étagères.",
    caption: "Boîtes d'archives cotées, York University Libraries (Canada)",
    author: "Smallison",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr",
    source: "https://commons.wikimedia.org/wiki/File:Boxes_of_archival_documents.jpg",
  },
  "anb-batiment": {
    width: 1920,
    height: 1440,
    alt: "Bâtiment des Archives nationales du Bénin à Porto-Novo, entouré de palmiers.",
    caption: "Archives nationales du Bénin, Porto-Novo",
    author: "Mathias Massodé",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr",
    source: "https://commons.wikimedia.org/wiki/File:Photo_ANB_mai_2021.jpg",
  },
  "anb-salle": {
    width: 1920,
    height: 725,
    alt: "Salle de recherche et de lecture, tables de consultation et comptoir d'accueil.",
    caption: "Salle de recherche des Archives nationales du Bénin",
    author: "Mathias Massodé",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr",
    source:
      "https://commons.wikimedia.org/wiki/File:Salle_de_Recherche_et_de_Lecture_des_Archives_Nationales_(B%C3%A9nin).jpg",
  },
} as const;

export type PhotoKey = keyof typeof PHOTOS;
