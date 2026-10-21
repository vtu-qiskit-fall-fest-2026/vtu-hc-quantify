"""QUANTA Variational Quantum Engine (Member B).

Modules:
- bitorder: Centralized little-endian normalization
- qubo: Binary quadratic problem formulation and Ising Hamiltonian mapping
- qaoa: Parameterized QAOA ansatz optimization loop (EstimatorV2, COBYLA/SPSA)
- noise: AerSimulator custom thermal relaxation & readout noise models
- ibm: Physical IBM Quantum QPU execution & offline FakeBackend
- interface: Thread-safe run_quantum() public facade
"""
