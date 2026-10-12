import i18n from "@/i18n";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getPieceGeometry } from "./pieceModels";
import type { Piece, Position } from "./utils";

type ChessBoard3DProps = {
    board: (Piece | null)[][];
    positions: Position[];
    selectedPosition: Position | null;
    onSquareClick: (rowIndex: number, colIndex: number) => void;
    /** Vrai pour le joueur des noirs : le plateau est vu depuis son côté (noirs en bas, blancs en haut). */
    flipped?: boolean;
};

const BOARD_LIGHT = 0xc9a66b;
const BOARD_DARK = 0x604331;
const BOARD_EDGE = 0x281d19;
const BOARD_RIM = 0x3a2a22;
const LEGAL_MOVE = 0x3cbf87;
const SELECTED_SQUARE = 0xe2a93b;
const WHITE_PIECE = 0xf1e8d4;
const BLACK_PIECE = 0x2b2522;

/** Hauteur du dessus des cases (la case est une boîte de 0.22 centrée sur y = 0). */
const SQUARE_TOP = 0.11;
/** Échelle des pièces : une case fait 1 de côté. */
const PIECE_SCALE = 0.92;
/** Hauteur dont la pièce sélectionnée se soulève. */
const LIFT = 0.22;
/** Caméra en perspective, côté des blancs par défaut (z positif) ou des noirs (z négatif) si le plateau est retourné. */
const CAMERA_HEIGHT = 11.5;
const CAMERA_DISTANCE = 10;
/** Déplacement du pointeur (px) au-delà duquel un appui est un geste de rotation et non un clic sur une case. */
const CLICK_TOLERANCE = 6;

/** Couleur d'accent du joueur (variable CSS --primary posée par son réglage et le thème), en entier 0xRRGGBB ; vert par défaut si elle est illisible. Le canvas convertit n'importe quel format CSS (hex, oklch…) en RGB. */
function readAccentColor(): number {
    try {
        const value = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
        if (!value) return LEGAL_MOVE;
        const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
        if (!context) return LEGAL_MOVE;
        context.fillStyle = "#000000";
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        return (red << 16) | (green << 8) | blue;
    } catch {
        return LEGAL_MOVE;
    }
}

function isLegalPosition(positions: Position[], rowIndex: number, colIndex: number): boolean {
    return positions.some((position) => position.x === colIndex && position.y === rowIndex);
}

type SceneState = {
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    pieceGroup: THREE.Group;
    highlightGroup: THREE.Group;
    squareMeshes: THREE.Mesh[];
    pieceMaterials: Record<"white" | "black", THREE.MeshStandardMaterial>;
    /** Pièces actuellement posées, pour les retrouver au clic. */
    pieceMeshes: THREE.Mesh[];
    /** Repères (a-h, 1-8) posés sur le cadre. */
    labels: THREE.Sprite[];
};

/** Distance du centre où se posent les repères : au milieu du cadre, juste hors des cases. */
const LABEL_OFFSET = 4.15;

/** Pose les lettres (colonnes) du côté du joueur et les chiffres (rangées) sur son côté gauche, pour qu'ils restent lisibles quand le plateau est retourné. */
function placeLabels(labels: THREE.Sprite[], flipped: boolean): void {
    labels.forEach((label) => {
        const { kind, index } = label.userData as { kind: "file" | "rank"; index: number };
        if (kind === "file") label.position.set(index - 3.5, 0.2, flipped ? -LABEL_OFFSET : LABEL_OFFSET);
        else label.position.set(flipped ? LABEL_OFFSET : -LABEL_OFFSET, 0.2, index - 3.5);
    });
}

/** Repère toujours tourné vers la caméra : une lettre ou un chiffre dessiné sur un canvas. */
function createLabel(text: string, kind: "file" | "rank", index: number): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
        context.font = "bold 44px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "#e9dcc3";
        context.fillText(text, 32, 34);
    }
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false }),
    );
    sprite.scale.set(0.34, 0.34, 1);
    sprite.userData = { kind, index };
    return sprite;
}

/** Retire un groupe de sa scène et libère les géométries/matériaux créés pour lui. */
function clearGroup(group: THREE.Group): void {
    group.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            (Array.isArray(object.material) ? object.material : [object.material]).forEach((material: THREE.Material) => material.dispose());
        }
    });
    group.clear();
}

export function ChessBoard3D({ board, positions, selectedPosition, onSquareClick, flipped = false }: ChessBoard3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const clickHandlerRef = useRef(onSquareClick);
    const sceneStateRef = useRef<SceneState | null>(null);

    useEffect(() => {
        clickHandlerRef.current = onSquareClick;
    }, [onSquareClick]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x171412);
        scene.fog = new THREE.Fog(0x171412, 18, 34);

        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
        camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
        camera.lookAt(0, 0.3, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.replaceChildren(renderer.domElement);
        renderer.domElement.setAttribute("aria-label", i18n.t("chess.page.boardAria"));
        renderer.domElement.setAttribute("role", "img");
        renderer.domElement.style.touchAction = "none";

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.rotateSpeed = 0.7;
        controls.minDistance = 9;
        controls.maxDistance = 20;
        // On peut tourner autour du plateau et l'incliner, mais jamais passer dessous.
        controls.minPolarAngle = 0.15;
        controls.maxPolarAngle = Math.PI / 2 - 0.12;
        controls.target.set(0, 0.3, 0);

        scene.add(new THREE.HemisphereLight(0xffead0, 0x211916, 1.7));
        const keyLight = new THREE.DirectionalLight(0xfff1d2, 3.2);
        keyLight.position.set(-5, 11, 6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.left = -7;
        keyLight.shadow.camera.right = 7;
        keyLight.shadow.camera.top = 7;
        keyLight.shadow.camera.bottom = -7;
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = 30;
        keyLight.shadow.bias = -0.0004;
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0x9ec5ff, 0.7);
        fillLight.position.set(6, 5, -7);
        scene.add(fillLight);

        // Socle et cadre du plateau.
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(9.1, 0.5, 9.1),
            new THREE.MeshStandardMaterial({ color: BOARD_EDGE, roughness: 0.7, metalness: 0.08 }),
        );
        base.position.y = -0.3;
        base.receiveShadow = true;
        base.castShadow = true;
        scene.add(base);
        const rim = new THREE.Mesh(
            new THREE.BoxGeometry(8.6, 0.18, 8.6),
            new THREE.MeshStandardMaterial({ color: BOARD_RIM, roughness: 0.6, metalness: 0.1 }),
        );
        rim.position.y = -0.02;
        rim.receiveShadow = true;
        scene.add(rim);

        const squareGeometry = new THREE.BoxGeometry(0.98, 0.22, 0.98);
        const squareMeshes: THREE.Mesh[] = [];
        const boardGroup = new THREE.Group();
        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            for (let colIndex = 0; colIndex < 8; colIndex += 1) {
                const color = (rowIndex + colIndex) % 2 === 0 ? BOARD_LIGHT : BOARD_DARK;
                const square = new THREE.Mesh(
                    squareGeometry,
                    new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.03 }),
                );
                square.position.set(colIndex - 3.5, 0, rowIndex - 3.5);
                square.receiveShadow = true;
                square.userData = { rowIndex, colIndex };
                boardGroup.add(square);
                squareMeshes.push(square);
            }
        }
        scene.add(boardGroup);

        const labels: THREE.Sprite[] = [];
        for (let index = 0; index < 8; index += 1) {
            // Ligne 0 = rang 8 ; colonne 0 = colonne « a ».
            labels.push(createLabel("abcdefgh"[index], "file", index), createLabel(String(8 - index), "rank", index));
        }
        placeLabels(labels, false);
        scene.add(...labels);

        const pieceGroup = new THREE.Group();
        const highlightGroup = new THREE.Group();
        scene.add(pieceGroup, highlightGroup);

        const pieceMaterials = {
            white: new THREE.MeshStandardMaterial({ color: WHITE_PIECE, roughness: 0.32, metalness: 0.08 }),
            black: new THREE.MeshStandardMaterial({ color: BLACK_PIECE, roughness: 0.38, metalness: 0.15 }),
        };

        sceneStateRef.current = { renderer, camera, controls, pieceGroup, highlightGroup, squareMeshes, pieceMaterials, pieceMeshes: [], labels };

        // Sélection d'une case ou d'une pièce au clic ; un glisser (rotation de la vue) n'est pas un clic.
        const pointer = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        let pressedAt: { x: number; y: number } | null = null;
        const handlePointerDown = (event: PointerEvent) => {
            pressedAt = { x: event.clientX, y: event.clientY };
        };
        const handlePointerUp = (event: PointerEvent) => {
            const start = pressedAt;
            pressedAt = null;
            if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_TOLERANCE) return;
            const bounds = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const targets = [...(sceneStateRef.current?.pieceMeshes ?? []), ...squareMeshes];
            const hit = raycaster.intersectObjects(targets, false)[0]?.object;
            if (!hit) return;
            const { rowIndex, colIndex } = hit.userData as { rowIndex: number; colIndex: number };
            clickHandlerRef.current(rowIndex, colIndex);
        };
        renderer.domElement.addEventListener("pointerdown", handlePointerDown);
        renderer.domElement.addEventListener("pointerup", handlePointerUp);

        const resizeObserver = new ResizeObserver(() => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (!width || !height) return;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false);
        });
        resizeObserver.observe(container);

        let frame = 0;
        const animate = () => {
            frame = window.requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            window.cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
            renderer.domElement.removeEventListener("pointerup", handlePointerUp);
            controls.dispose();
            clearGroup(highlightGroup);
            // Les géométries des pièces sont partagées (cache du module) : on ne libère que les matériaux.
            pieceGroup.clear();
            pieceMaterials.white.dispose();
            pieceMaterials.black.dispose();
            squareMeshes.forEach((square) => (square.material as THREE.Material).dispose());
            squareGeometry.dispose();
            labels.forEach((label) => {
                (label.material as THREE.SpriteMaterial).map?.dispose();
                label.material.dispose();
            });
            [base, rim].forEach((mesh) => {
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
            });
            renderer.dispose();
            container.replaceChildren();
            sceneStateRef.current = null;
        };
    }, []);

    // Orientation du plateau (après la création de la scène, qui pose la caméra par défaut) : l'équipe du joueur est toujours en bas de son écran.
    useEffect(() => {
        const sceneState = sceneStateRef.current;
        if (!sceneState) return;
        const { camera, controls, labels } = sceneState;
        placeLabels(labels, flipped);
        camera.position.set(0, CAMERA_HEIGHT, flipped ? -CAMERA_DISTANCE : CAMERA_DISTANCE);
        camera.lookAt(0, 0.3, 0);
        controls.update();
    }, [flipped]);

    // Pièces, case sélectionnée et destinations possibles.
    useEffect(() => {
        const sceneState = sceneStateRef.current;
        if (!sceneState) return;
        const { highlightGroup, pieceGroup, squareMeshes, pieceMaterials } = sceneState;

        clearGroup(highlightGroup);
        pieceGroup.clear();
        sceneState.pieceMeshes = [];
        const accent = readAccentColor();

        squareMeshes.forEach((square, index) => {
            const rowIndex = Math.floor(index / 8);
            const colIndex = index % 8;
            const selected = selectedPosition?.y === rowIndex && selectedPosition.x === colIndex;
            (square.material as THREE.MeshStandardMaterial).color.setHex(
                selected ? SELECTED_SQUARE : (rowIndex + colIndex) % 2 === 0 ? BOARD_LIGHT : BOARD_DARK,
            );

            if (!isLegalPosition(positions, rowIndex, colIndex)) return;
            const capture = Boolean(board[rowIndex]?.[colIndex]);
            // Case libre : un disque ; case occupée par une pièce adverse (prise) : un anneau autour d'elle.
            const marker = capture
                ? new THREE.Mesh(
                    new THREE.RingGeometry(0.34, 0.46, 40),
                    new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
                )
                : new THREE.Mesh(
                    new THREE.CylinderGeometry(0.16, 0.16, 0.03, 32),
                    new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.1 }),
                );
            if (capture) marker.rotation.x = -Math.PI / 2;
            marker.position.set(colIndex - 3.5, SQUARE_TOP + (capture ? 0.01 : 0.02), rowIndex - 3.5);
            highlightGroup.add(marker);
        });

        board.forEach((row, rowIndex) => row.forEach((piece, colIndex) => {
            if (!piece) return;
            const mesh = new THREE.Mesh(getPieceGeometry(piece.type), pieceMaterials[piece.color]);
            const selected = selectedPosition?.y === rowIndex && selectedPosition.x === colIndex;
            mesh.scale.setScalar(PIECE_SCALE);
            mesh.position.set(colIndex - 3.5, SQUARE_TOP + (selected ? LIFT : 0), rowIndex - 3.5);
            // Les cavaliers regardent en diagonale vers le camp adverse : de la caméra on voit leur profil (de dos, la tête serait une simple plaque).
            if (piece.type === "knight") mesh.rotation.y = piece.color === "white" ? Math.PI / 4 : (-3 * Math.PI) / 4;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { rowIndex, colIndex };
            pieceGroup.add(mesh);
            sceneState.pieceMeshes.push(mesh);
        }));
    }, [board, positions, selectedPosition]);

    return <div ref={containerRef} className="aspect-square w-full overflow-hidden border border-border bg-[#171412]" />;
}
