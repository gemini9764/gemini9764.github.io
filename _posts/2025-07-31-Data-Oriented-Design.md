---
title: 데이터 지향 설계와 성능 사고
description: 데이터 지향 설계와 성능 사고
author: gemini
date: 2025-07-31 19:00:00 +09:00
categories: [Unreal]
tags: [Data-Oriented]
math: true
mermaid: true
---

#### 성능 사고의 기초

- 성능이 중요한 이유
	- 게임 개발은 다른 소프트웨어 개발과 달리 **실시간성**이 핵심
		- 게임의 성능 요구사항
			- 60 fps : 16.67ms 내에 한 프레임을 완성해야 함
			- 12 fps : 8.33ms (고주사율 모니터, VR)
			- **일관된 프레임 타임** : 끊김 없는 부드러운 경험

```
// 게임 루프의 기본 구조
void GameLoop() {
    while (isRunning) {
        float deltaTime = timer.GetDeltaTime(); // 목표: 16.67ms

        ProcessInput(deltaTime);    // ~1ms
        UpdateGameLogic(deltaTime); // ~10ms
        Render();                   // ~5ms
        Present();                  // ~0.67ms

        // 만약 16.67ms를 초과하면 프레임 드롭 발생!
    }
}
```

- 성능이 게임에 미치는 영향
	- 플레이어 경험 : 렉은 게임의 재미를 직접적으로 해침
	- 경쟁력 : 60 fps vs 30 fps는 게임의 상업적 성공을 좌우
	- 플랫폼 제약 : 콘솔, 모바일 등 제한된 하드웨어에서 동작해야 함


#### 성능 병목 : CPU vs GPU vs Memory vs I/O

- CPU 병목

```
// 잘못된 예시: 매 프레임마다 복잡한 연산
void Update() {
    for (auto& enemy : enemies) {
        // 복잡한 AI 연산을 매 프레임마다 실행
        enemy.UpdateComplexAI();
    }
}

// 개선된 예시: 시간 분할 처리
void Update() {
    static int currentIndex = 0;
    int processCount = std::min(10, enemies.size()); // 한 프레임에 10개만 처리

    for (int i = 0; i < processCount; i++) {
        enemies[currentIndex % enemies.size()].UpdateComplexAI();
        currentIndex++;
    }
}
```

- GPU 병목
	- 너무 많은 드로우 콜
	- 복잡한 셰이더 연산
	- 오버드로우 (같은 픽셀을 여러 번 그리기)
- Memory 병목
	- 캐시 미스로 인한 대기 시간
	- 메모리 할당/해제 비용
	- 가상 메모리 페이징
- I/O 병목
	- 파일 로딩 시간
	- 네트워크 지연


#### 측정 없는 최적화는 독이다 - 프로파일링의 중요성

- 프로파일링의 원칙
	1. 측정 먼저 : 추측하지 말고 실제로 측정하라
	2. 핫스팟 집중 : 전체 시간의 80%를 차지하는 20% 코드를 찾아라
	3. 개선 후 재측정 : 최적화가 실제로 효과가 있는지 확인하라

```
// 간단한 성능 측정 도구
class SimpleProfiler {
public:
    void StartTiming(const std::string& name) {
        startTimes[name] = std::chrono::high_resolution_clock::now();
    }

    void EndTiming(const std::string& name) {
        auto endTime = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>
                       (endTime - startTimes[name]).count();

        std::cout << name << ": " << duration << " μs\\n";
    }
};

// 사용 예시
void GameLoop() {
    profiler.StartTiming("GameLogic");
    UpdateGameLogic();
    profiler.EndTiming("GameLogic");
}

```


#### 메모리와 캐시의 이해

- 메모리 계측구조와 접근 비용
	- 계층적으로 구성된 현대 컴퓨터의 메모리

```
CPU Register:    0 cycles    (4 bytes)
L1 Cache:        1 cycle     (32KB)
L2 Cache:        3 cycles    (256KB)
L3 Cache:        12 cycles   (8MB)
Main Memory:     200 cycles  (16GB)
SSD:             100,000 cycles
HDD:             10,000,000 cycles
```

 - 캐시의 작동 원리
	 - CPU가 데이터를 요청하면 L1 -> L2 -> L3 -> RAM 순으로 찾음
	 - 찾은 데이터는 상위 캐시로 복사됨 (캐시 라인 단위, 보통 64바이트)
	 - 캐시 히트 : 캐시에서 데이터를 찾은 경우 (빠름)
	 - 캐시 미스 : 캐시에서 데이터를 찾지 못한 경우 (느림)


#### 캐시 미스가 성능에 미치는 영향

```
// 캐시 미스가 많이 발생하는 코드
struct Player {
    int id;
    std::string name;        // 가변 크기, 힙 할당
    Vector3 position;
    Vector3 velocity;
    float health;
    // ... 많은 다른 데이터들
    bool isAlive;           // 자주 접근하는 데이터
};

std::vector<Player> players;

// 살아있는 플레이어만 업데이트 - 캐시 효율 나쁨
for (auto& player : players) {
    if (player.isAlive) {  // 전체 Player 구조체를 캐시로 로드해야 함
        UpdatePosition(player);
    }
}
```

```
// 캐시 친화적인 개선된 코드
struct PlayerSoA {
    std::vector<int> ids;
    std::vector<Vector3> positions;
    std::vector<Vector3> velocities;
    std::vector<float> healths;
    std::vector<bool> isAlives;        // 자주 접근하는 데이터끼리 모음
    std::vector<std::string> names;    // 덜 자주 접근하는 데이터
};

PlayerSoA players;

// 살아있는 플레이어만 업데이트 - 캐시 효율 좋음
for (size_t i = 0; i < players.isAlives.size(); ++i) {
    if (players.isAlives[i]) {  // bool 배열만 캐시로 로드
        UpdatePosition(players.positions[i], players.velocities[i]);
    }
}
```


#### 메모리 레이아웃과 데이터 지역성

- 공간적 지역성 (Spatial Locality) : 연속된 메모리 위치의 데이터에 접근할 가능성이 높음

```
// 좋은 예시: 연속된 메모리 접근
int sum = 0;
for (int i = 0; i < 1000; ++i) {
    sum += array[i];  // 연속된 메모리 위치 접근
}

// 나쁜 예시: 불연속적인 메모리 접근
int sum = 0;
for (int i = 0; i < 1000; i += 7) {  // 7 간격으로 점프
    sum += array[i];
}

```

- 시간적 지역성 (Temporal Locality) : 최근에 접근한 데이터에 다시 접근할 가능성이 높음

```
// 시간적 지역성 활용
Vector3 playerPos = player.GetPosition();  // 한 번만 호출
float distanceSq = (playerPos - targetPos).LengthSquared();
if (distanceSq < attackRangeSq) {
    // playerPos를 재사용
    LaunchProjectile(playerPos, targetPos);
}
```


#### 데이터 지향 설계 vs 객체 지향 설계

- 객체 지향의 한계와 성능 문제
	- 객체지향 설계는 코드의 가독성과 유지보수성에는 뛰어나지만, 성능 측면에서는 한계가 있음

```
// 전형적인 객체 지향 설계
class GameObject {
public:
    virtual void Update(float deltaTime) = 0;  // 가상 함수 호출 비용
    virtual void Render() = 0;

protected:
    Transform transform;
    std::string name;           // 사용하지 않을 수도 있는 데이터
    bool isActive;
    // ... 많은 다른 멤버들
};

class Enemy : public GameObject {
    AI* aiComponent;            // 포인터 -> 캐시 미스 가능성
    Renderer* renderer;
    Physics* physics;

public:
    void Update(float deltaTime) override {
        // 여러 컴포넌트에 접근 -> 메모리 점프
        aiComponent->Update(deltaTime);
        physics->Update(deltaTime);
    }
};

// 사용
std::vector<std::unique_ptr<GameObject>> gameObjects;
for (auto& obj : gameObjects) {
    obj->Update(deltaTime);  // 가상 함수 호출, 예측 불가능한 메모리 접근
}
```

- 성능 문제는 무엇?
	- 가상 함수 호출 비용 : vtable 룩업, 분기 예측 실패
	- 메모리 단편화 : 객체들이 메모리에 흩어져 있음
	- 불필요한 데이터 로드 : 사용하지 않는 멤버 변수도 캐시에 로드
	- 컴포넌트 접근 : 포인터를 통한 간접 접근으로 캐시 미스 증가


#### 데이터 지향 설계의 핵심 원칙 (Data-Oriented Design)

- 데이터 지향 설계는 데이터의 변환에 집중
- 핵심 원칙
	1. 데이터가 코드를 이끈다 : 데이터 레이아웃을 먼저 고려
	2. 변환 중심 사고 : Input -> Process -> Output
	3. 캐시 친화성 : 함께 사용되는 데이터는 함께 배치
	4. 배치 처리 : 같은 연산을 여러 데이터에 일괄 적용

```
// 데이터 지향 설계 예시
struct TransformData {
    std::vector<Vector3> positions;
    std::vector<Vector3> velocities;
    std::vector<Vector3> accelerations;
    size_t count;
};

struct RenderData {
    std::vector<Matrix4> worldMatrices;
    std::vector<MaterialID> materials;
    std::vector<MeshID> meshes;
    size_t count;
};

// 시스템: 순수 함수로 데이터 변환
void UpdatePhysics(TransformData& transforms, float deltaTime) {
    // SIMD 최적화 가능, 예측 가능한 메모리 접근
    for (size_t i = 0; i < transforms.count; ++i) {
        transforms.velocities[i] += transforms.accelerations[i] * deltaTime;
        transforms.positions[i] += transforms.velocities[i] * deltaTime;
    }
}

void PrepareRenderData(const TransformData& transforms, RenderData& renderData) {
    for (size_t i = 0; i < transforms.count; ++i) {
        renderData.worldMatrices[i] = CreateWorldMatrix(transforms.positions[i]);
    }
}
```


#### AoS vs SoA : 구조체 배열 vs 배열 구조체

- 데이터 지향 설계의 핵심 개념 중 하나
- **AoS (Array of Structures) - 구조체 배열**

```
struct Particle {
    Vector3 position;    // 12 bytes
    Vector3 velocity;    // 12 bytes
    float life;          // 4 bytes
    Color color;         // 16 bytes (패딩 포함)
};                       // 총 44 bytes per particle

std::vector<Particle> particles(1000);

// 위치만 업데이트하는 경우
for (auto& particle : particles) {
    particle.position += particle.velocity * deltaTime;
    // 44바이트 전체를 캐시로 로드하지만 24바이트만 사용
}
```

- **SoA (Structure of Arrays) - 배열 구조체**

```
struct ParticleSystem {
    std::vector<Vector3> positions;   // 연속된 위치 데이터
    std::vector<Vector3> velocities;  // 연속된 속도 데이터
    std::vector<float> lives;         // 연속된 생명 데이터
    std::vector<Color> colors;        // 연속된 색상 데이터
    size_t count;
};

ParticleSystem particles;
particles.positions.resize(1000);
particles.velocities.resize(1000);

// 위치만 업데이트하는 경우
for (size_t i = 0; i < particles.count; ++i) {
    particles.positions[i] += particles.velocities[i] * deltaTime;
    // 필요한 24바이트만 캐시로 로드
}
```

- 성능 비교 실험

```
// 벤치마크 코드
void BenchmarkAoS() {
    std::vector<Particle> particles(100000);

    auto start = std::chrono::high_resolution_clock::now();
    for (int iter = 0; iter < 1000; ++iter) {
        for (auto& p : particles) {
            p.position += p.velocity * 0.016f;
        }
    }
    auto end = std::chrono::high_resolution_clock::now();

    std::cout << "AoS: " << std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count() << "ms\\n";
}

void BenchmarkSoA() {
    ParticleSystem particles;
    particles.count = 100000;
    particles.positions.resize(particles.count);
    particles.velocities.resize(particles.count);

    auto start = std::chrono::high_resolution_clock::now();
    for (int iter = 0; iter < 1000; ++iter) {
        for (size_t i = 0; i < particles.count; ++i) {
            particles.positions[i] += particles.velocities[i] * 0.016f;
        }
    }
    auto end = std::chrono::high_resolution_clock::now();

    std::cout << "SoA: " << std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count() << "ms\\n";
}

// 일반적인 결과: SoA가 2-3배 빠름
```


#### ECS(Entity Component System) 패턴

- ECS는 데이터 지향 설계의 대표적인 아키텍처 패턴
- 전통적인 상속 vs ECS

```
// 전통적인 상속 기반
class GameObject { ... };
class Character : public GameObject { ... };
class Player : public Character { ... };
class Enemy : public Character { ... };
class FlyingEnemy : public Enemy { ... };  // 다중 상속 문제 발생 가능

// ECS 방식
struct Entity {
    uint32_t id;
};

struct Position { Vector3 value; };
struct Velocity { Vector3 value; };
struct Health { float current, max; };
struct Renderer { MeshID mesh; MaterialID material; };
struct AI { AIType type; float aggroRange; };

class World {
    // 컴포넌트별로 데이터를 분리 저장
    std::vector<Position> positions;
    std::vector<Velocity> velocities;
    std::vector<Health> healths;
    std::vector<Renderer> renderers;
    std::vector<AI> ais;

    // 엔티티가 어떤 컴포넌트를 가지고 있는지 추적
    std::vector<std::bitset<32>> componentMasks;
};

// 시스템: 특정 컴포넌트 조합을 가진 엔티티들을 일괄 처리
void MovementSystem(World& world) {
    for (size_t i = 0; i < world.entities.size(); ++i) {
        if (world.HasComponents<Position, Velocity>(i)) {
            world.positions[i].value += world.velocities[i].value * deltaTime;
        }
    }
}
```

- ECS의 장점
	- 구성의 유연성 : 런타임에 컴포넌트 추가/제거 가능
	- 캐시 친화성 : 같은 타임의 컴포넌트들이 연속적으로 배치
	- 병렬 처리 : 시스템별로 독립전인 처리 가능
	- 메모리 효율설 : 필요한 컴포넌트만 메모리에 존재


#### 기초적인 최적화 기법의 이해

- 핫스팟 식별과 병목 해결
	- 80-20 법칙 : 전체 실행 시간의 80%는 코드의 20%에서 소모된다

```
// 프로파일링으로 발견한 핫스팟 예시
void GameUpdate() {
    profiler.Start("AI");
    UpdateAI();           // 35% 시간 소모
    profiler.End("AI");

    profiler.Start("Physics");
    UpdatePhysics();      // 25% 시간 소모
    profiler.End("Physics");

    profiler.Start("Rendering");
    UpdateRendering();    // 15% 시간 소모
    profiler.End("Rendering");

    profiler.Start("Audio");
    UpdateAudio();        // 5% 시간 소모
    profiler.End("Audio");

    // AI 최적화가 가장 큰 효과를 가져올 것!
}
```

- 단계적 최적화 접근
	1. 알고리즘 개선  : O(n²) → O(n log n)
	2. 데이터 구조 개선 : 캐시 친화적 레이아웃
	3. 미시 최적화 : 루프 언롤링, SIMD 등


#### 배치 처리와 SIMD 활용

- 배치 처리의 힘

```
// 개별 처리 - 비효율적
for (auto& enemy : enemies) {
    enemy.Update();
    enemy.CheckCollision();
    enemy.UpdateAnimation();
}

// 배치 처리 - 효율적
UpdateAllEnemyPositions(enemies);    // 모든 위치를 한 번에
CheckAllCollisions(enemies);         // 모든 충돌을 한 번에
UpdateAllAnimations(enemies);        // 모든 애니메이션을 한 번에
```

- SIMD (Single Instruction, Multiple Data) 예시

```
// 일반적인 벡터 덧셈
for (int i = 0; i < count; ++i) {
    result[i] = a[i] + b[i];
}

// SIMD를 활용한 벡터 덧셈 (4개씩 동시 처리)
#include <immintrin.h>
for (int i = 0; i < count; i += 4) {
    __m128 va = _mm_load_ps(&a[i]);
    __m128 vb = _mm_load_ps(&b[i]);
    __m128 vr = _mm_add_ps(va, vb);
    _mm_store_ps(&result[i], vr);
}
```


#### 메모리 풀링과 할당 최적화

- 동적 메모리 할당은 성능의 적

```
class Bullet {
public:
    Vector3 position;
    Vector3 velocity;
    float damage;
    float lifeTime;
    bool isActive;
};

std::vector<Bullet*> bullets;

void SpawnBullet(Vector3 position, Vector3 velocity) {
    Bullet* bullet = new Bullet();  // 힙 할당 - 느림!
    bullet->position = position;
    bullet->velocity = velocity;
    bullet->damage = 25.0f;
    bullet->lifeTime = 3.0f;
    bullet->isActive = true;
    
    bullets.push_back(bullet);
}

void UpdateBullets(float deltaTime) {
    for (auto it = bullets.begin(); it != bullets.end();) {
        Bullet* bullet = *it;
        
        bullet->position += bullet->velocity * deltaTime;
        bullet->lifeTime -= deltaTime;
        
        if (bullet->lifeTime <= 0 || bullet->position.y < 0) {
            delete bullet;  // 힙 해제 - 느림!
            it = bullets.erase(it);
        } else {
            ++it;
        }
    }
}
```

- 오브젝트 풀링 적용

```
class BulletPool {
private:
    std::vector<Bullet> bullets;      // 미리 할당된 총알들
    std::queue<size_t> available;     // 사용 가능한 인덱스들
    std::vector<bool> isActive;       // 각 총알의 활성화 상태

public:
    BulletPool(size_t maxCount) : bullets(maxCount), isActive(maxCount, false) {
        // 모든 인덱스를 사용 가능 목록에 추가
        for (size_t i = 0; i < maxCount; ++i) {
            available.push(i);
        }
    }

    Bullet* GetBullet() {
        if (available.empty()) {
            return nullptr;  // 풀이 가득 참
        }
        
        size_t index = available.front();
        available.pop();
        isActive[index] = true;
        
        return &bullets[index];  // 이미 할당된 메모리 재사용
    }

    void ReturnBullet(Bullet* bullet) {
        // 포인터로부터 인덱스 계산
        size_t index = bullet - &bullets[0];
        
        // 상태 초기화
        bullet->Reset();
        isActive[index] = false;
        
        // 풀에 반환
        available.push(index);
    }
    
    void UpdateAll(float deltaTime) {
        for (size_t i = 0; i < bullets.size(); ++i) {
            if (isActive[i]) {
                bullets[i].position += bullets[i].velocity * deltaTime;
                bullets[i].lifeTime -= deltaTime;
                
                if (bullets[i].lifeTime <= 0) {
                    ReturnBullet(&bullets[i]);
                }
            }
        }
    }
};
```

```
// 전역 풀
BulletPool bulletPool(1000);  // 최대 1000발

void SpawnBullet(Vector3 position, Vector3 velocity) {
    Bullet* bullet = bulletPool.GetBullet();  // 빠름!
    if (bullet) {
        bullet->Initialize(position, velocity, 25.0f, 3.0f);
    }
}

void UpdateBullets(float deltaTime) {
    bulletPool.UpdateAll(deltaTime);  // 모든 활성 총알 업데이트
}
```


>언제 객체 지향을, 언제 데이터 지향을 사용해야 할까?<br>
> - 개발 단계별 고려사항<br>
> - 팀 규모와 유지보수성<br>
> - 성능 요구사항<br>
{: .prompt-info}

>게임 장르별 최적화 전략의 차이점<br>
> - FPS vs RTS vs MMO<br>
> - 모바일 vs PC vs 콘솔<br>
{: .prompt-info}

>최적화의 트레이드오프<br>
> - 성능 vs 가독성<br>
> - 메모리 vs 속도<br>
> - 개발 시간 vs 실행 성능<br>
{: .prompt-info}