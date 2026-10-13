import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PieceType } from "./utils";

/** Pièces d'échecs modélisées en volume, sans fichier externe : corps de révolution (lathe) + détails (couronne, créneaux, croix) et une tête de cheval extrudée. Chaque type est fusionné en une seule géométrie, partagée par toutes les pièces du même type. */

/** [Major · Graphismes 3D] Profil de révolution : liste de [rayon, hauteur] de bas en haut, terminée sur l'axe pour fermer le volume. */
function lathe(profile: [number, number][]): THREE.BufferGeometry {
    return new THREE.LatheGeometry(
        profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
        40,
    );
}

/** [Major · Graphismes 3D] Géométrie d'une sphère (éventuellement aplatie) placée à la hauteur y. */
function sphere(radius: number, y: number, scaleY = 1): THREE.BufferGeometry {
    const geometry = new THREE.SphereGeometry(radius, 28, 20);
    geometry.scale(1, scaleY, 1);
    geometry.translate(0, y, 0);
    return geometry;
}

/** [Major · Graphismes 3D] Géométrie d'une boîte positionnée en (x, y, z). */
function box(width: number, height: number, depth: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(x, y, z);
    return geometry;
}

/** [Major · Graphismes 3D] Petites billes régulièrement réparties sur un cercle (pointes de la couronne de la dame). */
function ringOfSpheres(count: number, ringRadius: number, sphereRadius: number, y: number): THREE.BufferGeometry[] {
    return Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2;
        const geometry = new THREE.SphereGeometry(sphereRadius, 16, 12);
        geometry.translate(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius);
        return geometry;
    });
}

/** [Major · Graphismes 3D] Créneaux de la tour : petits blocs sur le pourtour, orientés vers l'extérieur. */
function battlements(count: number, ringRadius: number, y: number): THREE.BufferGeometry[] {
    return Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2;
        const geometry = new THREE.BoxGeometry(0.13, 0.16, 0.2);
        geometry.rotateY(-angle);
        geometry.translate(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius);
        return geometry;
    });
}

/** [Major · Graphismes 3D] Tête et encolure du cheval : silhouette de profil (museau vers +x) extrudée en épaisseur. */
function knightHead(): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, 0.16);
    shape.lineTo(0.26, 0.16);
    shape.quadraticCurveTo(0.3, 0.36, 0.34, 0.52);
    shape.lineTo(0.47, 0.62);
    shape.quadraticCurveTo(0.5, 0.7, 0.44, 0.76);
    shape.lineTo(0.3, 0.8);
    shape.lineTo(0.22, 0.98);
    shape.lineTo(0.12, 0.86);
    shape.quadraticCurveTo(-0.04, 0.9, -0.14, 0.8);
    shape.quadraticCurveTo(-0.3, 0.5, -0.22, 0.16);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.24,
        bevelEnabled: true,
        bevelSize: 0.06,
        bevelThickness: 0.06,
        bevelSegments: 3,
        curveSegments: 14,
    });
    geometry.translate(0, 0, -0.12);
    return geometry;
}

const BODIES: Record<PieceType, () => THREE.BufferGeometry[]> = {
    pawn: () => [
        lathe([[0, 0], [0.34, 0], [0.36, 0.05], [0.32, 0.1], [0.22, 0.17], [0.14, 0.34], [0.13, 0.46], [0.23, 0.5], [0.23, 0.54], [0.12, 0.58], [0, 0.58]]),
        sphere(0.17, 0.72),
    ],
    rook: () => [
        lathe([[0, 0], [0.37, 0], [0.39, 0.06], [0.33, 0.12], [0.25, 0.2], [0.21, 0.5], [0.2, 0.66], [0.31, 0.72], [0.31, 0.92], [0.27, 0.92], [0, 0.92]]),
        ...battlements(6, 0.255, 0.99),
    ],
    knight: () => [
        lathe([[0, 0], [0.36, 0], [0.38, 0.06], [0.32, 0.12], [0.3, 0.2], [0, 0.2]]),
        knightHead(),
    ],
    bishop: () => [
        lathe([[0, 0], [0.35, 0], [0.37, 0.06], [0.3, 0.12], [0.2, 0.22], [0.12, 0.5], [0.12, 0.68], [0.21, 0.72], [0.21, 0.76], [0.1, 0.8], [0, 0.8]]),
        sphere(0.17, 1.0, 1.4),
        sphere(0.06, 1.34),
    ],
    queen: () => [
        lathe([[0, 0], [0.38, 0], [0.4, 0.06], [0.33, 0.13], [0.21, 0.26], [0.13, 0.62], [0.14, 0.98], [0.24, 1.04], [0.32, 1.22], [0.27, 1.24], [0.14, 1.12], [0, 1.1]]),
        ...ringOfSpheres(8, 0.29, 0.055, 1.25),
        sphere(0.085, 1.28),
    ],
    king: () => [
        lathe([[0, 0], [0.38, 0], [0.4, 0.06], [0.33, 0.13], [0.21, 0.26], [0.13, 0.62], [0.14, 1.0], [0.25, 1.06], [0.29, 1.2], [0.2, 1.26], [0.1, 1.3], [0, 1.3]]),
        box(0.09, 0.3, 0.09, 0, 1.46, 0),
        box(0.26, 0.09, 0.09, 0, 1.5, 0),
    ],
};

const cache = new Map<PieceType, THREE.BufferGeometry>();

/** [Major · Graphismes 3D] Géométrie (unique, mise en cache) d'un type de pièce, posée sur y = 0 et centrée sur son axe. */
export function getPieceGeometry(type: PieceType): THREE.BufferGeometry {
    const cached = cache.get(type);
    if (cached) return cached;
    // mergeGeometries exige des géométries de même nature : tout en non indexé.
    const parts = BODIES[type]().map((part) => (part.index ? part.toNonIndexed() : part));
    const merged = mergeGeometries(parts) ?? parts[0];
    parts.forEach((part) => part !== merged && part.dispose());
    merged.computeVertexNormals();
    cache.set(type, merged);
    return merged;
}
