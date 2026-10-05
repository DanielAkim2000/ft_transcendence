import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Piece, Position } from "./utils";

type ChessBoard3DProps = {
    board: (Piece | null)[][];
    positions: Position[];
    selectedPosition: Position | null;
    onSquareClick: (rowIndex: number, colIndex: number) => void;
};

const BOARD_LIGHT = 0xc9a66b;
const BOARD_DARK = 0x604331;
const BOARD_EDGE = 0x281d19;
const LEGAL_MOVE = 0x3cbf87;
const SELECTED_SQUARE = 0xe2a93b;

function getPieceImage(piece: Piece): string {
    const pieceLetters: Record<Piece["type"], string> = {
        pawn: "P",
        rook: "R",
        knight: "N",
        bishop: "B",
        queen: "Q",
        king: "K",
    };
    return `/chess/${piece.color === "black" ? "b" : "w"}${pieceLetters[piece.type]}.svg`;
}

function isLegalPosition(positions: Position[], rowIndex: number, colIndex: number): boolean {
    return positions.some((position) => position.x === colIndex && position.y === rowIndex);
}

export function ChessBoard3D({ board, positions, selectedPosition, onSquareClick }: ChessBoard3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const clickHandlerRef = useRef(onSquareClick);
    const sceneStateRef = useRef<{
        renderer: THREE.WebGLRenderer;
        camera: THREE.OrthographicCamera;
        controls: OrbitControls;
        boardGroup: THREE.Group;
        pieceGroup: THREE.Group;
        highlightGroup: THREE.Group;
        squareMeshes: THREE.Mesh[];
        pieceSprites: THREE.Sprite[];
        pieceTextures: Map<string, THREE.Texture>;
    } | null>(null);
    useEffect(() => {
        clickHandlerRef.current = onSquareClick;
    }, [onSquareClick]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x171412);
        const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
        camera.position.set(0, 12, 0.01);
        camera.lookAt(0, 0, 0);
        camera.zoom = 1.05;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.replaceChildren(renderer.domElement);
        renderer.domElement.setAttribute("aria-label", "Plateau d'échecs en 3D");
        renderer.domElement.setAttribute("role", "img");

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.enableRotate = true;
        controls.rotateSpeed = 0.55;
        controls.minZoom = 0.9;
        controls.maxZoom = 1.7;
        controls.minPolarAngle = 0.01;
        controls.maxPolarAngle = 0.01;
        controls.target.set(0, 0, 0);

        scene.add(new THREE.HemisphereLight(0xffead0, 0x211916, 2.1));
        const keyLight = new THREE.DirectionalLight(0xfff1d2, 3.4);
        keyLight.position.set(-5, 10, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);

        const base = new THREE.Mesh(
            new THREE.BoxGeometry(8.7, 0.55, 8.7),
            new THREE.MeshStandardMaterial({ color: BOARD_EDGE, roughness: 0.7, metalness: 0.08 }),
        );
        base.position.y = -0.28;
        base.receiveShadow = true;
        scene.add(base);

        const boardGroup = new THREE.Group();
        const pieceGroup = new THREE.Group();
        const highlightGroup = new THREE.Group();
        const squareMeshes: THREE.Mesh[] = [];
        const pieceSprites: THREE.Sprite[] = [];

        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            for (let colIndex = 0; colIndex < 8; colIndex += 1) {
                const color = (rowIndex + colIndex) % 2 === 0 ? BOARD_LIGHT : BOARD_DARK;
                const square = new THREE.Mesh(
                    new THREE.BoxGeometry(0.96, 0.22, 0.96),
                    new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02 }),
                );
                square.position.set(colIndex - 3.5, 0, rowIndex - 3.5);
                square.receiveShadow = true;
                square.userData = { rowIndex, colIndex };
                boardGroup.add(square);
                squareMeshes.push(square);
            }
        }
        for (let squareIndex = 0; squareIndex < 64; squareIndex += 1) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
            sprite.scale.set(0.72, 0.72, 1);
            sprite.visible = false;
            pieceSprites.push(sprite);
            pieceGroup.add(sprite);
        }
        boardGroup.add(highlightGroup, pieceGroup);
        scene.add(boardGroup);
        sceneStateRef.current = {
            renderer,
            camera,
            controls,
            boardGroup,
            pieceGroup,
            highlightGroup,
            squareMeshes,
            pieceSprites,
            pieceTextures: new Map(),
        };

        const pointer = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        const handlePointerDown = (event: PointerEvent) => {
            const bounds = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const square = raycaster.intersectObjects(squareMeshes, false)[0]?.object as THREE.Mesh | undefined;
            if (!square) return;
            const { rowIndex, colIndex } = square.userData as { rowIndex: number; colIndex: number };
            clickHandlerRef.current(rowIndex, colIndex);
        };
        renderer.domElement.addEventListener("pointerdown", handlePointerDown);

        const resizeObserver = new ResizeObserver(() => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (!width || !height) return;
            const aspect = width / height;
            camera.left = -5 * aspect;
            camera.right = 5 * aspect;
            camera.top = 5;
            camera.bottom = -5;
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
            controls.dispose();
            sceneStateRef.current?.pieceTextures.forEach((texture) => texture.dispose());
            boardGroup.traverse((object: THREE.Object3D) => {
                if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
                    object.geometry.dispose();
                    if (Array.isArray(object.material)) object.material.forEach((material: THREE.Material) => material.dispose());
                    else object.material.dispose();
                }
            });
            base.geometry.dispose();
            base.material.dispose();
            renderer.dispose();
            container.replaceChildren();
            sceneStateRef.current = null;
        };
    }, []);

    useEffect(() => {
        const sceneState = sceneStateRef.current;
        if (!sceneState) return;

        const { highlightGroup, squareMeshes, pieceSprites, pieceTextures } = sceneState;
        const disposeGroup = (group: THREE.Group) => {
            group.traverse((object: THREE.Object3D) => {
                if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
                    object.geometry.dispose();
                    if (Array.isArray(object.material)) object.material.forEach((material: THREE.Material) => material.dispose());
                    else object.material.dispose();
                }
            });
            group.clear();
        };

        disposeGroup(highlightGroup);

        squareMeshes.forEach((square, index) => {
            const rowIndex = Math.floor(index / 8);
            const colIndex = index % 8;
            const selected = selectedPosition?.y === rowIndex && selectedPosition.x === colIndex;
            const material = square.material as THREE.MeshStandardMaterial;
            material.color.setHex(selected ? SELECTED_SQUARE : (rowIndex + colIndex) % 2 === 0 ? BOARD_LIGHT : BOARD_DARK);

            if (isLegalPosition(positions, rowIndex, colIndex)) {
                const marker = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.13, 0.13, 0.04, 24),
                    new THREE.MeshStandardMaterial({ color: LEGAL_MOVE, roughness: 0.45, metalness: 0.1 }),
                );
                marker.position.set(colIndex - 3.5, 0.15, rowIndex - 3.5);
                highlightGroup.add(marker);
            }
        });

        const textureLoader = new THREE.TextureLoader();
        board.forEach((row, rowIndex) => row.forEach((piece, colIndex) => {
            const sprite = pieceSprites[rowIndex * 8 + colIndex];
            sprite.visible = Boolean(piece);
            if (!piece) return;
            const texturePath = getPieceImage(piece);
            let texture = pieceTextures.get(texturePath);
            if (!texture) {
                texture = textureLoader.load(texturePath);
                texture.colorSpace = THREE.SRGBColorSpace;
                pieceTextures.set(texturePath, texture);
            }
            const material = sprite.material as THREE.SpriteMaterial;
            material.map = texture;
            material.needsUpdate = true;
            sprite.position.set(colIndex - 3.5, 0.9, rowIndex - 3.5);
        }));
    }, [board, positions, selectedPosition]);

    return <div ref={containerRef} className="aspect-square w-full overflow-hidden border border-border bg-[#171412]" />;
}
